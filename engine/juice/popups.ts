"use client";
import { create } from "zustand";
import { TUNING } from "@/config/tuning";

export type PopupStyle = "hero" | "big" | "small" | "bad" | "coin";

export interface Popup {
  id: number;
  text: string;
  sub?: string;
  style: PopupStyle;
  color?: string;
  /** Screen position in % (defaults to centre-ish). */
  x?: number;
  y?: number;
}

interface PopupState {
  popups: Popup[];
  push: (p: Omit<Popup, "id">, duration?: number) => void;
  clear: () => void;
}

let nextId = 1;

export const usePopups = create<PopupState>((set) => ({
  popups: [],
  push: (p, duration = TUNING.juice.popupDuration) => {
    const id = nextId++;
    set((s) => ({ popups: [...s.popups.slice(-4), { ...p, id }] }));
    window.setTimeout(() => set((s) => ({ popups: s.popups.filter((q) => q.id !== id) })), duration * 1000);
  },
  clear: () => set({ popups: [] }),
}));

/** Fire-and-forget popup text ("NICE!", "+1", …). */
export const popup = (p: Omit<Popup, "id">, duration?: number) => usePopups.getState().push(p, duration);
