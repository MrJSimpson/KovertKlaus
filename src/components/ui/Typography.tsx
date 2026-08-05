'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export function Heading({
  level = 2,
  children,
  className = '',
}: {
  level?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();

  if (level === 1) {
    return <h1 className={`text-3xl font-black ${theme.textHeading} ${className}`}>{children}</h1>;
  }
  if (level === 2) {
    return <h2 className={`text-2xl font-black flex items-center gap-2 ${theme.textHeading} ${className}`}>{children}</h2>;
  }
  if (level === 3) {
    return <h3 className={`text-xl font-black ${theme.textHeading} ${className}`}>{children}</h3>;
  }
  return <h4 className={`text-lg font-bold ${theme.textHeading} ${className}`}>{children}</h4>;
}

export function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { theme } = useTheme();
  return <span className={`${theme.textLabel} ${className}`}>{children}</span>;
}

export function SubText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { theme } = useTheme();
  return <p className={`text-xs ${theme.textSubLabel} ${className}`}>{children}</p>;
}

export function DataRow({
  label,
  value,
  valueVariant = 'default',
  className = '',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueVariant?: 'default' | 'accent' | 'date' | 'bold';
  className?: string;
}) {
  const { theme } = useTheme();

  let valueStyle = theme.textLabel;
  if (valueVariant === 'accent') valueStyle = theme.textAccent;
  if (valueVariant === 'date') valueStyle = theme.textDate;

  return (
    <div className={`flex justify-between items-center text-xs ${className}`}>
      <span className={theme.textLabel}>{label}:</span>
      <strong className={valueStyle}>{value}</strong>
    </div>
  );
}
