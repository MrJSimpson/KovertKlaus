'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'outer' | 'inner' | 'section' | 'console';
  children: React.ReactNode;
}

export function Card({ variant = 'outer', children, className = '', ...props }: CardProps) {
  const { theme } = useTheme();

  let variantStyle = theme.cardBg;
  if (variant === 'inner') {
    variantStyle = theme.cardInnerBg;
  } else if (variant === 'section') {
    variantStyle = theme.sectionFrame;
  } else if (variant === 'console') {
    variantStyle = theme.consoleCard;
  }

  return (
    <div
      className={`rounded-3xl border transition-all ${
        variant === 'inner' ? 'p-4 rounded-2xl' : 'p-6 sm:p-8 shadow-md'
      } ${variantStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 flex items-center justify-between ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mt-6 pt-3 border-t border-stone-200 dark:border-slate-800 flex items-center justify-between ${className}`}>{children}</div>;
}
