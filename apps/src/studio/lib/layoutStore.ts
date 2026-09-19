import type { FootprintVertex } from "@galleryis/shared";

// Where a visitor's hang lives between visits: IndexedDB on their own device,
// nowhere else. This is the storage half of the §2 privacy stance, the image
// bytes are held locally so they never have to be uploaded to come back.
//
// Two object stores rather than one record: the layout is a small JSON blob the
// debounced writer rewrites on every drag, while the images are large and
// written once. Keeping them apart means a drag doesn't rewrite megabytes, and
// the by-hall index makes both hall-scoped and global deletion a range delete.

const DB_NAME = "galleryis-studio";
const DB_VERSION = 1;
const LAYOUTS = "layouts";
const IMAGES = "images";
const BY_HALL = "by-hall";

/**
 * Record-content version, independent of `DB_VERSION` (which guards store
 * *shape*). A record from another schema is deleted rather than migrated: this
 * is a convenience cache of a local layout, not authored content we owe
 * continuity to, and a half-understood record that breaks hydration is far
 * worse than a forgotten one.
 */
export const SCHEMA = 1;

/** The part of a hung work that survives a reload, never the objectURL, never the canvas. */
export interface DurableWork {
  id: string;
  name: string;
  aspect: number;
  wall_index: number;
  offset_m: number;
  elevation_cm: number;
  width_cm: number;
  height_cm: number;
}

export interface LayoutRecord {
  hallId: string;
  schema: number;
  /** Identifies this hall's layout if it is ever attached to an application. */
  sessionId: string;
  manualLayout: boolean;
  savedAt: number;
  /** Detects a hall whose footprint changed under a saved layout. */
  footprintKey: string;
  works: DurableWork[];
}

/**
 * `"full"` means the device is out of room: the caller keeps working in memory
 * and says so, rather than throwing at someone mid-hang.
 */
export type SaveResult = "ok" | "full" | "off";

/**
 * Images are stored as raw bytes plus their MIME type rather than as Blobs.
 * Blob support in IndexedDB has a long history of engine bugs (older Safari
 * returned dead Blobs after a restart), an ArrayBuffer is structured-cloneable
 * everywhere, and the reader materialises a Blob immediately anyway to make an
 * objectURL. The Blob-in, Blob-out API above hides the difference.
 */
interface StoredImage {
  id: string;
  hallId: string;
  bytes: ArrayBuffer;
  type: string;
}

export interface LayoutStore {
  /** False when IndexedDB is missing or refused (private mode). */
  readonly available: boolean;
  loadLayout(hallId: string): Promise<LayoutRecord | null>;
  saveLayout(record: LayoutRecord): Promise<SaveResult>;
  deleteLayout(hallId: string): Promise<void>;
  saveImage(hallId: string, id: string, blob: Blob): Promise<SaveResult>;
  loadImages(hallId: string): Promise<Map<string, Blob>>;
  deleteImage(id: string): Promise<void>;
  /** Every hall's layout and every image, gone. */
  clearAll(): Promise<void>;
}

/** Cheap identity for a hall's plan; changes when a footprint is re-traced. */
export function footprintKey(footprint: FootprintVertex[]): string {
  return footprint.map((v) => `${v.x},${v.z}`).join("|");
}

function isQuotaError(error: unknown): boolean {
  // Duck-typed rather than `instanceof DOMException`: the name is what every
  // engine agrees on, and Firefox uses its own. Code 22 is the legacy spelling.
  const candidate = error as { name?: string; code?: number } | null;
  return (
    !!candidate &&
    (candidate.name === "QuotaExceededError" ||
      candidate.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      candidate.code === 22)
  );
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexeddb request failed"));
  });
}

function settled(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexeddb write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexeddb write aborted"));
  });
}

/**
 * A store that quietly does nothing. Returned instead of null whenever
 * IndexedDB can't be used, so no call site has to null-check, a device in
 * private mode simply behaves the way the studio behaved before this existed.
 */
export function createNullLayoutStore(): LayoutStore {
  return {
    available: false,
    async loadLayout() {
      return null;
    },
    async saveLayout() {
      return "off";
    },
    async deleteLayout() {},
    async saveImage() {
      return "off";
    },
    async loadImages() {
      return new Map();
    },
    async deleteImage() {},
    async clearAll() {},
  };
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Feature-detect by *attempting* the open: Firefox's private windows expose
    // `indexedDB` and then error the request, and iOS Safari has historically
    // thrown here synchronously.
    if (typeof indexedDB === "undefined") {
      reject(new Error("no indexeddb"));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LAYOUTS)) {
        db.createObjectStore(LAYOUTS, { keyPath: "hallId" });
      }
      if (!db.objectStoreNames.contains(IMAGES)) {
        db.createObjectStore(IMAGES, { keyPath: "id" }).createIndex(
          BY_HALL,
          "hallId",
        );
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexeddb open failed"));
    // Another tab holds an older version open; don't hang forever waiting.
    request.onblocked = () => reject(new Error("indexeddb open blocked"));
  });
}

export function createLayoutStore(): LayoutStore {
  let connection: Promise<IDBDatabase | null> | null = null;
  let usable = true;

  const db = (): Promise<IDBDatabase | null> => {
    connection ??= open().catch(() => {
      usable = false;
      return null;
    });
    return connection;
  };

  const read = async <T>(
    store: string,
    run: (store: IDBObjectStore) => Promise<T>,
    fallback: T,
  ): Promise<T> => {
    const database = await db();
    if (!database) return fallback;
    try {
      return await run(
        database.transaction(store, "readonly").objectStore(store),
      );
    } catch {
      return fallback;
    }
  };

  const write = async (
    stores: string[],
    run: (tx: IDBTransaction) => void,
  ): Promise<SaveResult> => {
    const database = await db();
    if (!database) return "off";
    try {
      const tx = database.transaction(stores, "readwrite");
      run(tx);
      await settled(tx);
      return "ok";
    } catch (error) {
      // Out of room is the one failure the UI has something to say about; every
      // other write failure is nothing the visitor can act on, so it stays
      // quiet and the session continues in memory.
      return isQuotaError(error) ? "full" : "off";
    }
  };

  return {
    get available() {
      return usable;
    },

    async loadLayout(hallId) {
      const record = await read<LayoutRecord | null>(
        LAYOUTS,
        (store) => promisify(store.get(hallId)),
        null,
      );
      if (!record) return null;
      if (record.schema !== SCHEMA) {
        await this.deleteLayout(hallId);
        return null;
      }
      return record;
    },

    saveLayout(record) {
      return write([LAYOUTS], (tx) => tx.objectStore(LAYOUTS).put(record));
    },

    async deleteLayout(hallId) {
      await write([LAYOUTS, IMAGES], (tx) => {
        tx.objectStore(LAYOUTS).delete(hallId);
        const index = tx.objectStore(IMAGES).index(BY_HALL);
        const cursor = index.openKeyCursor(IDBKeyRange.only(hallId));
        cursor.onsuccess = () => {
          const at = cursor.result;
          if (!at) return;
          tx.objectStore(IMAGES).delete(at.primaryKey);
          at.continue();
        };
      });
    },

    async saveImage(hallId, id, blob) {
      const bytes = await blob.arrayBuffer();
      return write([IMAGES], (tx) =>
        tx.objectStore(IMAGES).put({ id, hallId, bytes, type: blob.type }),
      );
    },

    async loadImages(hallId) {
      const rows = await read<StoredImage[]>(
        IMAGES,
        (store) =>
          promisify(store.index(BY_HALL).getAll(IDBKeyRange.only(hallId))),
        [],
      );
      return new Map(
        rows.map((row) => [row.id, new Blob([row.bytes], { type: row.type })]),
      );
    },

    async deleteImage(id) {
      await write([IMAGES], (tx) => tx.objectStore(IMAGES).delete(id));
    },

    async clearAll() {
      // One transaction over both stores rather than deleteDatabase(), which
      // blocks on this connection and on any other open tab.
      await write([LAYOUTS, IMAGES], (tx) => {
        tx.objectStore(LAYOUTS).clear();
        tx.objectStore(IMAGES).clear();
      });
    },
  };
}
