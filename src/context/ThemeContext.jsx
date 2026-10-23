import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ theme: "light", setTheme: () => {}, toggleTheme: () => {} });

const STORAGE_KEY = "theme";

// The app is LIGHT by default, always. Dark mode is strictly an opt-in choice
// the user makes in Sidebar → Appearance. We deliberately do NOT read
// `prefers-color-scheme` here: a laptop/phone switching to dark at sunset must
// never flip the app's theme on its own.
function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The current tab still uses the selected theme without persistent storage.
    }
  }, [theme]);

  // Keep state and <html class="dark"> in sync even if another tab changes the
  // saved preference, so the theme can never be half-applied.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      setThemeState(e.newValue === "dark" ? "dark" : "light");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = (next) => setThemeState(next === "dark" ? "dark" : "light");
  const toggleTheme = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
