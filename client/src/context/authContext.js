import { createContext } from "react";

// The context object alone — same reason as themeContext.js. A file exporting a
// component must export nothing else, or Fast Refresh falls back to reloading the
// whole page and ESLint fails the build over it.
export const AuthContext = createContext(null);
