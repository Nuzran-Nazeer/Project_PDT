import { createContext } from "react";

// Kept apart from the provider: a component file exporting anything else breaks Fast Refresh.
export const ThemeContext = createContext(null);
