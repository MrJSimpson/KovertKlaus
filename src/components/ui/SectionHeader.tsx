'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  className = '',
}: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200/80 dark:border-slate-800 ${className}`}>
      <div>
        <h2 className={`text-2xl font-black flex items-center gap-2 ${theme.textHeading}`}>
          {title}
        </h2>
        {subtitle && <p className={`text-xs mt-0.5 ${theme.textSubLabel}`}>{subtitle}</p>}
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-3">
          {/* Primary creation action ALWAYS comes first per UX rule */}
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
