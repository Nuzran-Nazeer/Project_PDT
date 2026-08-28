import { createContext } from "react";

// The context object alone. A file exporting a component must export nothing else,
// or Fast Refresh reloads the whole page and ESLint fails the build over it.
export const AuthContext = createContext(null);
