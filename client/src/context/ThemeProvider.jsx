import { useState } from "react";
import { ThemeContext } from "./themeContext";

// ⚠️ Must match the script in index.html, or the page paints one theme and React switches it.
const STORAGE_KEY = "pdt-theme";

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the theme still works, unremembered.
  }
};

const apply = (theme) =>
  document.documentElement.classList.toggle("dark", theme === "dark");

export function ThemeProvider({ children }) {
  // Read what the pre-paint script decided rather than working it out again.
  const [theme, setThemeState] = useState(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

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
