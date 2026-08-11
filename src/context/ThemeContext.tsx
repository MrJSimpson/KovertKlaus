'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getThemeClasses, ThemeClasses } from '@/lib/theme';
import { getTerminology, Terminology } from '@/lib/terminology';

const THEME_STORAGE_KEY = 'kovertklaus_theme_mode';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setDarkMode: (val: boolean) => void;
  theme: ThemeClasses;
  terminology: Terminology;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme !== null) {
      const isDark = savedTheme === 'dark';
      setIsDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Default to light mode (Christmas festive)
      document.documentElement.classList.remove('dark');
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const setDarkMode = (val: boolean) => {
    setIsDarkMode(val);
    localStorage.setItem(THEME_STORAGE_KEY, val ? 'dark' : 'light');
    if (val) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const theme = useMemo(() => getThemeClasses(isDarkMode), [isDarkMode]);
  const terminology = useMemo(() => getTerminology(isDarkMode), [isDarkMode]);

  const value = useMemo(
    () => ({
      isDarkMode,
      toggleTheme,
      setDarkMode,
      theme,
      terminology,
    }),
    [isDarkMode, theme, terminology]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    return {
      isDarkMode: false,
      toggleTheme: () => {},
      setDarkMode: () => {},
      theme: getThemeClasses(false),
      terminology: getTerminology(false),
    };
  }
  return context;
}
