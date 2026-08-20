import { createContext } from "react";

// The context object alone, in its own file.
//
// Kept apart from the provider because a file exporting a component must export
// nothing else: Vite's Fast Refresh cannot tell what changed otherwise and falls
// back to reloading the whole page on every edit. ESLint fails the build over it
// (`react-refresh/only-export-components`) rather than letting it degrade quietly.
export const ThemeContext = createContext(null);
