import { createJSONStorage, type StateStorage } from "zustand/middleware";

/**
 * localStorage wrapper that never throws (private mode, quota, SSR) — the game must keep
 * working even when nothing can be persisted.
 */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(name, value);
    } catch {
      /* storage full or blocked — ignore */
    }
  },
  removeItem: (name) => {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const saveStorage = createJSONStorage(() => safeLocalStorage);

/** Prefix for every persisted key so the hub can wipe all data in one go. */
export const SAVE_PREFIX = "modulo:";

export function saveKey(name: string) {
  return `${SAVE_PREFIX}${name}`;
}

export function wipeAllSaves() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(SAVE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
