import { useState } from "react";
import { ThemeContext } from "./themeContext";

// Must match the script in index.html. If these drift, the page paints one theme and
// React immediately switches it to the other.
const STORAGE_KEY = "pdt-theme";

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the theme still works, it just will not be remembered */
  }
};

const apply = (theme) =>
  document.documentElement.classList.toggle("dark", theme === "dark");

export function ThemeProvider({ children }) {
  // Read what the pre-paint script already decided rather than working it out again.
  // Two calculations of the same thing eventually disagree, and the visible symptom
  // is the flash that script exists to prevent.
  const [theme, setThemeState] = useState(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  // The operating system setting is not consulted anywhere: the app defaults to dark
  // for everyone, and only a deliberate switch changes that.
  const setTheme = (next) => {
    setThemeState(next);
    apply(next);
    write(STORAGE_KEY, next);
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
