"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveKey, saveStorage } from "./storage";

export type Quality = "auto" | "low" | "medium" | "high";
export type ThemePref = "system" | "dark" | "light";

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  quality: Quality;
  leftHanded: boolean;
  theme: ThemePref;
  /** Volume 0..1 */
  sfxVolume: number;
  musicVolume: number;
}

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void;
  /** Quality actually used when `quality === "auto"`; driven by the performance monitor. */
  autoQuality: Exclude<Quality, "auto">;
  setAutoQuality: (q: Exclude<Quality, "auto">) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  quality: "auto",
  leftHanded: false,
  theme: "system",
  sfxVolume: 0.9,
  musicVolume: 0.6,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      autoQuality: "high",
      set: (patch) => set(patch),
      setAutoQuality: (autoQuality) => set({ autoQuality }),
    }),
    {
      name: saveKey("settings"),
      version: 1,
      storage: saveStorage,
      partialize: ({ set: _s, setAutoQuality: _a, autoQuality: _q, ...rest }) => rest,
    },
  ),
);

/** Resolved render quality (auto → measured). */
export function useEffectiveQuality(): Exclude<Quality, "auto"> {
  return useSettings((s) => (s.quality === "auto" ? s.autoQuality : s.quality));
}

/** Non-hook accessor for engine code (audio, haptics) that runs outside React. */
export const getSettings = () => useSettings.getState();
