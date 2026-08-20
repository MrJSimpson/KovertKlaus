'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getThemeClasses, ThemeClasses, LightsStrandType } from '@/lib/theme';
import { PublicSystemConfigResponse } from '@/app/api/config/route';

const THEME_STORAGE_KEY = 'kovertklaus_theme_mode';

const DEFAULT_CONFIG: PublicSystemConfigResponse = {
  activeThemeId: 'winter_holiday',
  themeName: 'Winter Holiday (Klaus & Kovert)',
  activeSeason: 'winter',
  announcementBannerActive: true,
  bannerTextLight: '🎄 Welcome to KovertKlaus! Organize gift exchanges in under 60 seconds.',
  bannerTextDark: '❄️ Winter Night Ops Active — Covert Holiday Gifting',
  lightsStrandType: 'christmas_bulbs',
  lightTokens: {
    accentColor: '#dc2626',
    heroBadgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    btnPrimary: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-md shadow-red-900/20',
    btnSecondary: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm',
  },
  darkTokens: {
    accentColor: '#38bdf8',
    heroBadgeBg: 'bg-sky-950/70 text-sky-300 border-sky-800/80',
    btnPrimary: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-bold shadow-md shadow-sky-500/20',
    btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  },
  freeAnnualHostAllowance: 1,
  freeAnnualJoinAllowance: 3,
  paidEventPriceUsd: 5.0,
  maxFreeParticipants: 25,
  maxWishlistItems: 50,
  defaultBudgetMin: 0.0,
  defaultBudgetMax: 50.0,
  defaultCurrency: 'USD',
};

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setDarkMode: (val: boolean) => void;
  theme: ThemeClasses;
  activeThemeId: string;
  themeName: string;
  activeSeason: string;
  bannerText: string;
  bannerActive: boolean;
  lightsType: LightsStrandType;
  systemConfig: PublicSystemConfigResponse;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [systemConfig, setSystemConfig] = useState<PublicSystemConfigResponse>(DEFAULT_CONFIG);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Restore dark mode preference
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
      document.documentElement.classList.remove('dark');
    }

    // 2. Fetch database-driven public configuration
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === 'object') {
          setSystemConfig((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {
        // Fallback gracefully on network/offline errors
      })
      .finally(() => {
        setMounted(true);
      });
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

  const activeTokens = useMemo(() => {
    return isDarkMode ? systemConfig.darkTokens : systemConfig.lightTokens;
  }, [isDarkMode, systemConfig]);

  const theme = useMemo(() => {
    return getThemeClasses(isDarkMode, activeTokens);
  }, [isDarkMode, activeTokens]);

  const bannerText = useMemo(() => {
    return isDarkMode ? systemConfig.bannerTextDark : systemConfig.bannerTextLight;
  }, [isDarkMode, systemConfig]);

  const value = useMemo(
    () => ({
      isDarkMode,
      toggleTheme,
      setDarkMode,
      theme,
      activeThemeId: systemConfig.activeThemeId,
      themeName: systemConfig.themeName,
      activeSeason: systemConfig.activeSeason,
      bannerText,
      bannerActive: systemConfig.announcementBannerActive,
      lightsType: (systemConfig.lightsStrandType as LightsStrandType) || 'christmas_bulbs',
      systemConfig,
    }),
    [isDarkMode, theme, systemConfig, bannerText]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      isDarkMode: false,
      toggleTheme: () => {},
      setDarkMode: () => {},
      theme: getThemeClasses(false, DEFAULT_CONFIG.lightTokens),
      activeThemeId: DEFAULT_CONFIG.activeThemeId,
      themeName: DEFAULT_CONFIG.themeName,
      activeSeason: DEFAULT_CONFIG.activeSeason,
      bannerText: DEFAULT_CONFIG.bannerTextLight,
      bannerActive: DEFAULT_CONFIG.announcementBannerActive,
      lightsType: 'christmas_bulbs',
      systemConfig: DEFAULT_CONFIG,
    };
  }
  return context;
}

