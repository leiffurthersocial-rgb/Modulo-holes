import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True only on the client after hydration — gate anything that reads localStorage. */
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
