import { create } from "zustand";

export type CameraPreset = "tunnel" | "front" | "side";

/** One detection, addressed by camera, frame index and position in that frame. */
export interface DetectionRef {
  camera: string;
  frame: number;
  index: number;
}

interface RoomState {
  t: number; // playhead, seconds from the start of the recording
  playing: boolean;
  label: string | null; // highlight one label everywhere; null shows all
  focusCamera: string | null; // camera the 2D frame view shows
  hovered: DetectionRef | null;
  selected: DetectionRef | null;
  preset: CameraPreset;
  setT: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setLabel: (label: string | null) => void;
  setFocusCamera: (camera: string) => void;
  setHovered: (ref: DetectionRef | null) => void;
  setSelected: (ref: DetectionRef | null) => void;
  setPreset: (preset: CameraPreset) => void;
}

/** One store shared by the 3D tunnel and every 2D panel. */
export const useRoom = create<RoomState>((set) => ({
  t: 0,
  playing: false,
  label: null,
  focusCamera: null,
  hovered: null,
  selected: null,
  preset: "tunnel",
  setT: (t) => set({ t: Math.max(0, t) }),
  setPlaying: (playing) => set({ playing }),
  setLabel: (label) => set((s) => ({ label: s.label === label ? null : label })),
  setFocusCamera: (focusCamera) => set({ focusCamera }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set(selected ? { selected, playing: false, focusCamera: selected.camera } : { selected }),
  setPreset: (preset) => set({ preset }),
}));
