import { create } from "zustand";

// Where the visitor is being taken, and nothing else.
//
// Two decisions here are load-bearing enough to state:
//
// **It is not a field on `useWorksStore`.** That store's subscription turns any
// change into a debounced IndexedDB write of the layout. Walking across the
// room is not a change to the hang, and putting it there would schedule a
// storage write every time the camera moved.
//
// **It carries a work id, not a point.** `HallScene` recentres the footprint on
// its centroid before building its walls; `works.ts` builds the store's walls
// from the raw footprint. Lengths and indices agree between the two, but
// *points do not*, a viewpoint computed in the panel would be off by exactly
// that centroid, silently, in whichever direction the hall happens to sit.
// Resolving it inside the scene, from the scene's own geometry, removes the
// whole class of bug rather than correcting for it.

interface CameraState {
  /** The work to walk to, or null when nothing is pending. */
  focusId: string | null;
  /**
   * Bumped on every request. Asking twice for the same work is a real
   * instruction, "take me back to it", and an id alone could not tell the
   * scene that anything had happened.
   */
  seq: number;
  focus: (id: string) => void;
  clear: () => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  focusId: null,
  seq: 0,
  focus: (id) => set((state) => ({ focusId: id, seq: state.seq + 1 })),
  clear: () => set({ focusId: null }),
}));
