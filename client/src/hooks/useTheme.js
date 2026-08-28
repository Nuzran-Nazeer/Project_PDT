import { useContext } from "react";
import { ThemeContext } from "../context/themeContext";

// Throws rather than returning undefined, so a component used outside the provider
// fails immediately instead of crashing further down and pointing at the wrong file.
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return context;
}
