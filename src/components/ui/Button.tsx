'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'toggle' | 'neutral' | 'emerald' | 'amber' | 'sky';
  href?: string;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  href,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const { theme } = useTheme();

  let style = theme.btnPrimary;
  if (variant === 'secondary') style = theme.btnSecondary;
  if (variant === 'toggle') style = theme.btnToggle;
  if (variant === 'neutral') style = theme.btnNeutral;
  if (variant === 'emerald') style = theme.btnEmerald;
  if (variant === 'amber') style = theme.btnAmber;
  if (variant === 'sky') style = theme.btnSky;

  const baseClasses = `px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${style} ${className}`;

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button className={baseClasses} {...props}>
      {children}
    </button>
  );
}
