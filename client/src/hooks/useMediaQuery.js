import { useCallback, useSyncExternalStore } from "react";

// Not Tailwind, because a `md:` class can show and hide things but cannot change what
// a button DOES: the hamburger collapses a rail on desktop and opens a drawer on a
// phone. Not useState plus useEffect, because setting state in an effect body costs a
// second render pass and React warns about it; useSyncExternalStore also closes the
// gap where the window is resized before the listener is attached.
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};

      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    // Missing outside a browser, and a layout hook must not be why a test runner or
    // a build step falls over.
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // False is the right server-side default: it means a drawer that starts closed
  // rather than a rail that starts open.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
