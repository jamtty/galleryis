import type { ArtworkPlacement, Hall } from "@galleryis/shared";
import { create } from "zustand";
import { arrangeWorks } from "../lib/arrange";
import {
  encodeCanvas,
  loadArtworkImage,
  MAX_WORKS,
  validateFile,
  type UploadRejection,
} from "../lib/artworkImage";
import { cmToM, wallsFromFootprint, type Wall } from "../lib/geometry";
import {
  createNullLayoutStore,
  footprintKey,
  SCHEMA,
  type DurableWork,
  type LayoutRecord,
  type LayoutStore,
} from "../lib/layoutStore";
import {
  clampSize,
  DEFAULT_ELEVATION_CM,
  defaultSize,
  findSpot,
  maxWidthOn,
  resolveElevation,
  resolveOffset,
  type SizeCm,
  type WallLimits,
} from "../lib/placement";

// The bridge between the works panel (DOM) and the artwork layer (canvas):
// both read and mutate the same hung-works list here. Placement geometry is
// resolved inside the store, so every entry is always snapped, corner-clamped,
// and clear of the door, overlap is the one thing warned rather than fixed.
//
// The layout also persists to this device (lib/layoutStore), so a refresh or a
// night's sleep doesn't cost the visitor their hang. Nothing leaves the
// browser: the images are stored locally precisely so they never need to be
// uploaded to come back.

export interface Work extends ArtworkPlacement {
  id: string;
  name: string;
  /**
   * objectURL for the panel thumbnail, and the downscaled source the scene
   * textures from. Both null in review mode, where the gallery is looking at
   * an applicant's plan and the pictures were never sent, the invariant is
   * `canvas === null` ⟺ `mode === "review"`.
   *
   * One widened list rather than a parallel one: wall lookup, overlap
   * detection and label positioning all keep working, and the single place
   * that builds a texture has to make the empty case explicit.
   */
  url: string | null;
  canvas: HTMLCanvasElement | null;
  /** naturalWidth / naturalHeight, the cm inputs' aspect lock. */
  aspect: number;
}

export interface UploadError {
  name: string;
  reason: UploadRejection;
}

/** Whether this device is holding the layout, and why not when it isn't. */
export type Persistence = "on" | "off" | "full";

/** What hydration had to change to fit a saved layout into today's hall. */
export type RestoreNote = "moved" | "dropped" | null;

/**
 * `edit` is a visitor hanging their own show. `review` is the gallery looking
 * at one that was submitted: same hall, same placements, no pictures and
 * nothing to change.
 */
export type StudioMode = "edit" | "review";

// Wall lengths and indices are translation-invariant, so walls derived from
// the raw footprint here agree with the scene's centroid-recentred ones.
export interface HallContext {
  hallId: string;
  walls: Wall[];
  /** Door, glazing and the reception counter, every no-hang stretch. */
  limits: WallLimits;
  ceilingCm: number;
  footprintKey: string;
}

interface WorksState {
  context: HallContext | null;
  works: Work[];
  selectedId: string | null;
  /** While set, the camera rigs must not consume pointer drags. */
  draggingId: string | null;
  /**
   * Set once the visitor drags a work themselves, which stops the hall
   * re-hanging itself under them. `arrangeAll` hands control back.
   */
  manualLayout: boolean;
  uploadErrors: UploadError[];
  /** Identifies this hall's layout if it is ever attached to an application. */
  sessionId: string | null;
  /** True from arming a hall until its saved layout has been read back. */
  hydrating: boolean;
  persistence: Persistence;
  restoreNote: RestoreNote;
  mode: StudioMode;
  setHall: (hall: Hall, mode?: StudioMode) => void;
  /** Show a submitted layout: geometry in, no images, nothing mutable. */
  loadReviewLayout: (hall: Hall, works: ArtworkPlacement[]) => void;
  addFiles: (files: Iterable<File>) => Promise<void>;
  removeWork: (id: string) => void;
  selectWork: (id: string | null) => void;
  setDragging: (id: string | null) => void;
  updateSize: (id: string, edit: Partial<SizeCm>) => void;
  moveTo: (
    id: string,
    wallIndex: number,
    offsetM: number,
    elevationCm: number,
  ) => void;
  arrangeAll: () => void;
  /** Re-hang every work evenly along one wall. */
  arrangeOnWall: (wallIndex: number, gapM?: number) => void;
  dismissErrors: () => void;
  dismissRestoreNote: () => void;
  /** Wipes every hall's saved layout and images from this device. */
  clearSaved: () => Promise<void>;
}

// The storage port. Injected rather than imported directly so tests drive the
// store against a synchronous in-memory double, and so a device without
// IndexedDB simply keeps the no-op default.
let layoutStore: LayoutStore = createNullLayoutStore();

export function configureLayoutStore(store: LayoutStore): void {
  layoutStore = store;
}

/**
 * Bumped by every `setHall`. Hydration re-checks it after each await and bails
 * if the visitor has since moved to another hall, the same discipline
 * `addFiles` uses, since both race the hall the store is armed for.
 */
let epoch = 0;

const newSessionId = () => crypto.randomUUID();

/** Review-mode works have no objectURL to release. */
const revoke = (url: string | null) => {
  if (url) URL.revokeObjectURL(url);
};

/**
 * Re-hang the whole set across the hall. Works the arrange pass can't place,
 * wider than every run, or past the last of them, keep the placement they
 * already had, so a re-flow never strands a work off its wall.
 */
function reflow(works: Work[], context: HallContext): Work[] {
  const placements = arrangeWorks(
    context.walls,
    context.limits,
    context.ceilingCm,
    works,
  );
  return works.map((work, i) =>
    placements[i] ? { ...work, ...placements[i] } : work,
  );
}

/**
 * Re-hang `works` evenly along one wall, leaving the rest of the hall alone.
 *
 * `arrangeWorks` already lays a set out with equal gaps and matching margins;
 * handing it a single-wall array scopes that to one wall without a second copy
 * of the spacing math. Works already on the wall are re-spaced along with the
 * arrivals, which is the point, "이 벽에 다 걸어줘" means the wall ends up
 * looking hung, not that four works get shuffled around one that stayed put.
 */
function reflowWall(
  works: Work[],
  context: HallContext,
  wallIndex: number,
  gapM?: number,
): Work[] {
  const wall = context.walls[wallIndex];
  if (!wall) return works;
  const placements = arrangeWorks(
    [wall],
    context.limits,
    context.ceilingCm,
    works,
    gapM,
  );
  return works.map((work, i) =>
    placements[i] ? { ...work, ...placements[i] } : work,
  );
}

function durable(work: Work): DurableWork {
  return {
    id: work.id,
    name: work.name,
    aspect: work.aspect,
    wall_index: work.wall_index,
    offset_m: work.offset_m,
    elevation_cm: work.elevation_cm,
    width_cm: work.width_cm,
    height_cm: work.height_cm,
  };
}

export const useWorksStore = create<WorksState>((set, get) => {
  /**
   * Read a saved layout back into the live store.
   *
   * Placements are re-resolved against *today's* hall rather than trusted: a
   * footprint may have been re-traced, or a window added, since the layout was
   * saved. A work whose wall is gone is re-spotted; one that fits nowhere is
   * dropped. Either way the visitor is told, because silently moving someone's
   * hang is worse than admitting it moved.
   */
  const hydrate = async (context: HallContext, myEpoch: number) => {
    const stale = () => myEpoch !== epoch;
    let record: LayoutRecord | null = null;
    try {
      record = await layoutStore.loadLayout(context.hallId);
    } catch {
      record = null;
    }
    if (stale()) return;

    const finish = (
      restored: Work[],
      manual: boolean,
      sessionId: string,
      restoreNote: RestoreNote,
    ) => {
      if (stale()) {
        for (const work of restored) revoke(work.url);
        return;
      }
      set((state) => {
        // Anything uploaded while the read was in flight belongs to this hall
        // too, merge rather than clobber.
        const merged = [...restored, ...state.works].slice(0, MAX_WORKS);
        return {
          works: manual ? merged : reflow(merged, context),
          manualLayout: manual,
          sessionId,
          restoreNote,
          hydrating: false,
          persistence: layoutStore.available ? "on" : "off",
        };
      });
    };

    if (!record || record.schema !== SCHEMA) {
      finish([], false, record?.sessionId ?? newSessionId(), null);
      return;
    }

    const images = await layoutStore.loadImages(context.hallId);
    if (stale()) return;

    const restored: Work[] = [];
    let moved = record.footprintKey !== context.footprintKey;
    let dropped = false;
    for (const saved of record.works) {
      const blob = images.get(saved.id);
      if (!blob) {
        dropped = true;
        continue;
      }
      let image;
      try {
        image = await loadArtworkImage(blob);
      } catch {
        dropped = true;
        continue;
      }
      if (stale()) {
        URL.revokeObjectURL(image.url);
        for (const work of restored) revoke(work.url);
        return;
      }
      const placed = place(saved, context, restored);
      if (!placed) {
        URL.revokeObjectURL(image.url);
        dropped = true;
        continue;
      }
      if (placed.adjusted) moved = true;
      restored.push({
        id: saved.id,
        name: saved.name,
        url: image.url,
        canvas: image.canvas,
        aspect: saved.aspect,
        ...placed.placement,
      });
    }
    finish(
      restored,
      record.manualLayout,
      record.sessionId,
      dropped ? "dropped" : moved ? "moved" : null,
    );
  };

  return {
    context: null,
    works: [],
    selectedId: null,
    draggingId: null,
    manualLayout: false,
    uploadErrors: [],
    sessionId: null,
    hydrating: false,
    persistence: "off",
    restoreNote: null,
    mode: "edit",

    setHall: (hall, mode = "edit") => {
      // The mode has to be part of the comparison. Without it, leaving a
      // review link for the same hall hits this early return and the
      // visitor's own saved layout is never restored.
      if (get().context?.hallId === hall.id && get().mode === mode) return;
      for (const work of get().works) revoke(work.url);
      const context: HallContext = {
        hallId: hall.id,
        walls: wallsFromFootprint(hall.footprint),
        limits: {
          door: hall.door,
          windows: hall.windows,
          desk: hall.desk,
        },
        ceilingCm: hall.ceiling_cm,
        footprintKey: footprintKey(hall.footprint),
      };
      epoch += 1;
      set({
        context,
        works: [],
        selectedId: null,
        draggingId: null,
        manualLayout: false,
        uploadErrors: [],
        sessionId: null,
        hydrating: mode === "edit",
        restoreNote: null,
        mode,
      });
      // Review shows what was submitted; it must never read this device's
      // saved layout, and must never write over it either.
      if (mode === "edit") void hydrate(context, epoch);
    },

    loadReviewLayout: (hall, placements) => {
      const state = get();
      if (state.mode !== "review" || state.context?.hallId !== hall.id) return;
      set({
        // Rendered exactly as submitted, the opposite policy from hydration,
        // which re-clamps to keep an artist's own layout usable. Here the
        // gallery must see what the applicant actually asked for, out of
        // bounds and all.
        works: placements.map((placement, index) => ({
          ...placement,
          id: `review-${index}`,
          name: String(index + 1),
          url: null,
          canvas: null,
          aspect: placement.width_cm / placement.height_cm,
        })),
        manualLayout: true,
      });
    },

    addFiles: async (files) => {
      const { context, mode } = get();
      if (!context || mode === "review") return;
      // Errors surface per file as they happen, concurrent batches (the picker
      // can be reopened mid-decode) then append instead of clobbering each other.
      const report = (name: string, reason: UploadRejection) =>
        set((state) => ({
          uploadErrors: [...state.uploadErrors, { name, reason }],
        }));
      const sameHall = () => get().context?.hallId === context.hallId;
      for (const file of files) {
        const rejection = validateFile(file, get().works.length);
        if (rejection) {
          report(file.name, rejection);
          continue;
        }
        let image;
        try {
          image = await loadArtworkImage(file);
        } catch {
          if (!sameHall()) return;
          report(file.name, "unreadable");
          continue;
        }
        // The hall may have changed while the image decoded; the rest of this
        // batch belongs to the session setHall just cleared.
        if (!sameHall()) {
          URL.revokeObjectURL(image.url);
          return;
        }
        // A parallel batch may have filled the cap during the decode.
        if (get().works.length >= MAX_WORKS) {
          URL.revokeObjectURL(image.url);
          report(file.name, "limit");
          continue;
        }
        const aspect = image.naturalWidth / image.naturalHeight;
        const spot = (size: SizeCm) =>
          findSpot(
            context.walls,
            context.limits,
            get().works,
            cmToM(size.width_cm),
          );
        let size = defaultSize(image.naturalWidth, image.naturalHeight);
        let where = spot(size);
        if (!where) {
          // A 1 m default always fits the real halls; if a future hall is ever
          // narrower, shrink to its widest wall rather than refusing the file.
          // Widest *clear* span, so a mostly-glazed wall can't set the cap.
          const widest = context.walls.reduce((a, b) =>
            maxWidthOn(b, context.limits) > maxWidthOn(a, context.limits)
              ? b
              : a,
          );
          size = clampSize(
            aspect,
            size,
            widest,
            context.limits,
            context.ceilingCm,
          );
          where = spot(size);
        }
        if (!where) {
          URL.revokeObjectURL(image.url);
          report(file.name, "unreadable");
          continue;
        }
        const id = crypto.randomUUID();
        // Queued *before* the state change, so the layout write the change
        // triggers waits on it. Written once, here, the debounced layout
        // writer only rewrites the small placement record, never the megabytes.
        keepImage(context.hallId, id, image.canvas);
        set((state) => {
          const works = [
            ...state.works,
            {
              id,
              name: file.name,
              url: image.url,
              canvas: image.canvas,
              aspect,
              ...size,
              wall_index: where.wall_index,
              offset_m: where.offset_m,
              elevation_cm: resolveElevation(
                DEFAULT_ELEVATION_CM,
                size.height_cm,
                context.ceilingCm,
              ),
            },
          ];
          // findSpot above gives the arrival a home of its own; while the hall is
          // still arranging itself, re-balance the whole set around it so a batch
          // of uploads settles into a hang instead of crowding one wall.
          return { works: state.manualLayout ? works : reflow(works, context) };
        });
      }
    },

    removeWork: (id) => {
      const { context, mode } = get();
      if (mode === "review") return;
      const work = get().works.find((w) => w.id === id);
      if (work) revoke(work.url);
      void layoutStore.deleteImage(id);
      set((state) => {
        const works = state.works.filter((w) => w.id !== id);
        return {
          // The gap a removed work leaves closes up, same as an arrival opens one.
          works:
            state.manualLayout || !context ? works : reflow(works, context),
          selectedId: state.selectedId === id ? null : state.selectedId,
          draggingId: state.draggingId === id ? null : state.draggingId,
        };
      });
    },

    selectWork: (id) => set({ selectedId: id }),

    setDragging: (id) =>
      set((state) => ({
        draggingId: id,
        selectedId: id ?? state.selectedId,
      })),

    updateSize: (id, edit) => {
      const { context, mode } = get();
      if (!context || mode === "review") return;
      set((state) => {
        const works = state.works.map((work) => {
          if (work.id !== id) return work;
          const wall = context.walls[work.wall_index];
          if (!wall) return work;
          const size = clampSize(
            work.aspect,
            edit,
            wall,
            context.limits,
            context.ceilingCm,
          );
          return {
            ...work,
            ...size,
            // The resized work must still clear the corners, door and glazing.
            offset_m:
              resolveOffset(
                wall,
                cmToM(size.width_cm),
                work.offset_m,
                context.limits,
              ) ?? work.offset_m,
            elevation_cm: resolveElevation(
              work.elevation_cm,
              size.height_cm,
              context.ceilingCm,
            ),
          };
        });
        // Typing an artwork's true centimetres is what this tool is for, so a
        // resize re-balances the room rather than freezing it, unlike a drag,
        // which is a decision about where that work goes.
        return { works: state.manualLayout ? works : reflow(works, context) };
      });
    },

    moveTo: (id, wallIndex, offsetM, elevationCm) => {
      const { context, mode } = get();
      const wall = context?.walls[wallIndex];
      if (!context || !wall || mode === "review") return;
      const work = get().works.find((w) => w.id === id);
      if (!work) return;
      const offset = resolveOffset(
        wall,
        cmToM(work.width_cm),
        offsetM,
        context.limits,
      );
      // No room on the target wall, the drag stays where it was.
      if (offset === null) return;
      const elevation = resolveElevation(
        elevationCm,
        work.height_cm,
        context.ceilingCm,
      );
      // Pointer jitter inside one snap cell resolves to the same placement;
      // skipping the update keeps 120 Hz pointermove from re-rendering the
      // whole layer for nothing.
      if (
        work.wall_index === wallIndex &&
        work.offset_m === offset &&
        work.elevation_cm === elevation
      )
        return;
      set((state) => ({
        works: state.works.map((w) =>
          w.id === id
            ? {
                ...w,
                wall_index: wallIndex,
                offset_m: offset,
                elevation_cm: elevation,
              }
            : w,
        ),
        // Only a drag that actually lands somewhere new counts as taking over,
        // selecting a work, or nudging it inside one snap cell, leaves the hall
        // arranging itself.
        manualLayout: true,
      }));
    },

    arrangeOnWall: (wallIndex: number, gapM?: number) => {
      const { context, mode } = get();
      if (!context || mode === "review") return;
      // Everything the visitor has, gathered onto the one wall and spaced.
      // `manualLayout` stays true: this is a deliberate hang of one wall, not
      // a hand-back to the automatic whole-hall pass.
      set((state) => ({
        works: reflowWall(state.works, context, wallIndex, gapM),
        manualLayout: true,
      }));
    },

    arrangeAll: () => {
      const { context, mode } = get();
      if (!context || mode === "review") return;
      set((state) => ({
        works: reflow(state.works, context),
        manualLayout: false,
      }));
    },

    dismissErrors: () => set({ uploadErrors: [] }),

    dismissRestoreNote: () => set({ restoreNote: null }),

    clearSaved: async () => {
      // Through the same queue as every other write, so a save still in flight
      // cannot land after the erase and quietly undo it.
      await queueStorage(() => layoutStore.clearAll());
      for (const work of get().works) revoke(work.url);
      // A new id, so a layout already sent with an application can never be
      // joined to whatever this device does next.
      set({
        works: [],
        selectedId: null,
        draggingId: null,
        manualLayout: false,
        restoreNote: null,
        sessionId: newSessionId(),
      });
    },
  };
});

/**
 * Fit a saved placement into today's hall. Returns null when the work fits
 * nowhere at all; `adjusted` says whether anything had to give.
 */
function place(
  saved: DurableWork,
  context: HallContext,
  already: ArtworkPlacement[],
): { placement: ArtworkPlacement; adjusted: boolean } | null {
  const wall = context.walls[saved.wall_index];
  const size: SizeCm = wall
    ? clampSize(
        saved.aspect,
        { width_cm: saved.width_cm },
        wall,
        context.limits,
        context.ceilingCm,
      )
    : { width_cm: saved.width_cm, height_cm: saved.height_cm };
  const widthM = cmToM(size.width_cm);
  const offset = wall
    ? resolveOffset(wall, widthM, saved.offset_m, context.limits)
    : null;
  const spot =
    offset === null
      ? findSpot(context.walls, context.limits, already, widthM)
      : { wall_index: saved.wall_index, offset_m: offset };
  if (!spot) return null;
  const elevation = resolveElevation(
    saved.elevation_cm,
    size.height_cm,
    context.ceilingCm,
  );
  return {
    placement: { ...size, ...spot, elevation_cm: elevation },
    adjusted:
      spot.wall_index !== saved.wall_index ||
      spot.offset_m !== saved.offset_m ||
      elevation !== saved.elevation_cm ||
      size.width_cm !== saved.width_cm,
  };
}

/**
 * Encodes and stores in flight. The layout record waits on these: a record
 * naming an image that isn't stored yet would come back as a dropped work if
 * the visitor navigated in between, which reads as data loss.
 */
const pendingImages = new Set<Promise<unknown>>();

function keepImage(
  hallId: string,
  id: string,
  canvas: HTMLCanvasElement,
): void {
  const saving = encodeCanvas(canvas)
    .then((blob) => layoutStore.saveImage(hallId, id, blob))
    .then((result) => {
      if (result === "full") useWorksStore.setState({ persistence: "full" });
    })
    .catch(() => {
      // An image that can't be encoded just isn't saved; the work stays hung
      // for this session, which is what happened before any of this existed.
    })
    .finally(() => pendingImages.delete(saving));
  pendingImages.add(saving);
}

/** How long a drag settles before its placement is written. */
export const SAVE_DEBOUNCE_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Layout writes run one at a time, in the order they were asked for.
 *
 * They must: arming an empty hall schedules a delete, and if the visitor drops
 * an image in before that delete has reached the disk, the two overlap and the
 * delete lands last, taking the just-saved layout with it. Serialising also
 * means every write re-reads the store at *its* turn, so a queued delete that
 * is no longer true simply becomes a save.
 */
let writing: Promise<unknown> = Promise.resolve();

/** Run `task` after every storage write already asked for, failures included. */
function queueStorage<T>(task: () => Promise<T>): Promise<T> {
  const next = writing.then(task, task);
  writing = next;
  return next;
}

function writeLayout(): Promise<void> {
  return queueStorage(runWriteLayout);
}

async function runWriteLayout(): Promise<void> {
  // Images first, always, see `pendingImages`.
  if (pendingImages.size) await Promise.all([...pendingImages]);
  const state = useWorksStore.getState();
  const { context, sessionId } = state;
  // Guarded again at write time, not only at schedule time: the hall can change
  // inside the debounce window, and writing then would file one hall's works
  // under another's key.
  if (!context || !sessionId || state.hydrating) return;
  if (state.works.length === 0 && !state.manualLayout) {
    // Nothing hung is not a layout worth keeping, and it means "delete my
    // gallery" can't be undone by the write that follows it.
    await layoutStore.deleteLayout(context.hallId);
    return;
  }
  const result = await layoutStore.saveLayout({
    hallId: context.hallId,
    schema: SCHEMA,
    sessionId,
    manualLayout: state.manualLayout,
    savedAt: Date.now(),
    footprintKey: context.footprintKey,
    works: state.works.map(durable),
  });
  if (result === "full") useWorksStore.setState({ persistence: "full" });
}

/** Write now, cancelling any pending debounce. */
function flushLayout(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void writeLayout();
}

// One subscription for the whole app. The debounce exists for dragging,
// `moveTo` fires on every 10 cm snap cell, and an IndexedDB write per
// pointermove over a 3D canvas is the wrong thing to do to a phone. Adding or
// removing a work is a discrete decision, not a stream, so it writes at once:
// the visitor who hangs something and immediately closes the tab must not lose
// it to a timer that never fired.
useWorksStore.subscribe((state, previous) => {
  if (
    state.works === previous.works &&
    state.manualLayout === previous.manualLayout &&
    state.sessionId === previous.sessionId
  )
    return;
  // Never while hydrating: between setHall's reset and the read completing,
  // `works` is empty, and writing that would erase the very layout being read.
  // Review must not overwrite the visitor's own saved layout for this hall
  // with an applicant's image-less geometry.
  if (state.hydrating || !state.context || state.mode === "review") return;
  const discrete =
    state.works.length !== previous.works.length ||
    state.manualLayout !== previous.manualLayout ||
    state.sessionId !== previous.sessionId;
  if (discrete) {
    flushLayout();
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void writeLayout();
  }, SAVE_DEBOUNCE_MS);
});

// A resize or a drag still leaves a pending write; hand it in before the page
// goes away. `visibilitychange` is the reliable one on mobile, where a tab is
// often frozen rather than unloaded, and pagehide covers a plain navigation.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && saveTimer) flushLayout();
  });
  window.addEventListener("pagehide", () => {
    if (saveTimer) flushLayout();
  });
}
