'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export function FilterContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex items-center gap-1 p-1 rounded-xl border ${
        isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#F0F0F0] border-stone-300'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { theme, isDarkMode } = useTheme();

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg transition-all text-xs font-bold cursor-pointer ${
        active
          ? theme.btnPrimary
          : isDarkMode
          ? 'text-slate-400 hover:text-slate-200'
          : 'text-slate-700 hover:text-slate-950'
      }`}
    >
      {children}
    </button>
  );
}
