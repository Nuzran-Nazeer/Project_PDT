import { useCallback, useSyncExternalStore } from "react";

// Answers a CSS media query in JavaScript, and keeps answering it as the window
// changes.
//
// WHY NOT JUST TAILWIND. A `md:` class can show and hide things, but it cannot change
// what a button DOES. The hamburger has to collapse a rail on a desktop and open a
// drawer on a phone, and that is a behaviour decision, not a styling one. Everything
// that is only styling stays in Tailwind.
//
// WHY `useSyncExternalStore` RATHER THAN useState PLUS useEffect. The obvious version
// stores the answer in state and updates it from an effect, which React now warns
// about: setting state inside an effect body causes a second render pass every time.
// This hook is React's own answer for reading a value that lives outside React. It
// also closes the gap where the window is resized between the first render and the
// listener being attached, which the obvious version has to paper over.
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
    // Missing in a non-browser environment, and a layout hook must not be the reason
    // a test runner or a build step falls over.
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // The third argument is the answer when there is no browser at all. False is the
  // right default: the layout has to be correct when the query does not match, which
  // for us means a drawer that starts closed rather than a rail that starts open.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
