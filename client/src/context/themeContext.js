import { createContext } from "react";

// Kept apart from the provider: a file exporting a component must export nothing
// else, or Vite's Fast Refresh reloads the whole page on every edit. ESLint fails the
// build over it (`react-refresh/only-export-components`).
export const ThemeContext = createContext(null);
