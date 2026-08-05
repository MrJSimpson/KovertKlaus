'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export interface BadgeProps {
  variant?: 'code' | 'secret-santa' | 'white-elephant' | 'opsleader' | 'amber' | 'rose' | 'countdown';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'code', children, className = '' }: BadgeProps) {
  const { theme } = useTheme();

  let style = theme.badgeCode;
  if (variant === 'secret-santa') style = theme.badgeSecretSanta;
  if (variant === 'white-elephant') style = theme.badgeWhiteElephant;
  if (variant === 'opsleader') style = theme.consoleBadge;
  if (variant === 'amber') style = theme.badgeAmber;
  if (variant === 'rose') style = theme.badgeRose;
  if (variant === 'countdown') style = theme.badgeCountdown;

  return (
    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase inline-flex items-center gap-1 ${style} ${className}`}>
      {children}
    </span>
  );
}
