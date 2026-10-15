'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export function FilterContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-1 p-1 rounded-xl border bg-kk-inset border-kk-border ${className}`}
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
  const { theme } = useTheme();

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg transition-all text-xs font-bold cursor-pointer ${
        active
          ? theme.btnPrimary
          : 'text-kk-muted hover:text-kk-ink'
      }`}
    >
      {children}
    </button>
  );
}
