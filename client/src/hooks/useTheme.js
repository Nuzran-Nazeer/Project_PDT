import { useContext } from "react";
import { ThemeContext } from "../context/themeContext";

// Read the current theme and switch it.
//
// Throws rather than returning undefined, so a component used outside the provider
// fails immediately and says why — instead of crashing further down on something
// like `toggleTheme is not a function`, which points at the wrong file.
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return context;
}
