'use client';

import React from 'react';

export type LightsStrandType = 'christmas_bulbs' | 'easter_eggs' | 'tropic_lanterns' | 'spooky_pumpkins' | 'none';

export interface SeasonalLightsProps {
  type?: LightsStrandType;
  isDarkMode?: boolean;
}

export const SeasonalLightsStrand: React.FC<SeasonalLightsProps> = ({ type = 'christmas_bulbs', isDarkMode = false }) => {
  if (type === 'none') return null;

  // 1. Classic Christmas Bulbs (Winter)
  if (type === 'christmas_bulbs') {
    const bulbColors = isDarkMode
      ? ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#38bdf8']
      : ['#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#ef4444'];

    return (
      <div className="flex items-center justify-around w-full py-1 overflow-hidden opacity-90 select-none">
        {bulbColors.map((color, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-1 h-1.5 bg-zinc-600 rounded-t-sm" />
            <div
              className="w-2.5 h-3.5 rounded-full shadow-sm animate-pulse"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}`,
                animationDuration: `${1.2 + (i % 3) * 0.4}s`,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // 2. Pastel Easter Eggs (Spring)
  if (type === 'easter_eggs') {
    const eggColors = ['#a7f3d0', '#fbcfe8', '#fed7aa', '#ddd6fe', '#bae6fd', '#fef08a'];
    return (
      <div className="flex items-center justify-around w-full py-1 overflow-hidden opacity-90 select-none">
        {eggColors.map((color, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-1 h-1 bg-emerald-700/50 rounded-t-sm" />
            <div
              className="w-2.5 h-3.5 rounded-[50%/60%_60%_40%_40%] shadow-sm animate-pulse"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 6px ${color}`,
                animationDuration: `${1.5 + (i % 3) * 0.3}s`,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // 3. Tropical Lanterns (Summer / Tropic Klaus)
  if (type === 'tropic_lanterns') {
    const lanternColors = ['#f97316', '#06b6d4', '#eab308', '#ec4899', '#14b8a6', '#f97316'];
    return (
      <div className="flex items-center justify-around w-full py-1 overflow-hidden opacity-90 select-none">
        {lanternColors.map((color, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-1 h-1.5 bg-amber-800/60 rounded-t-sm" />
            <div
              className="w-3 h-3 rounded-sm shadow-sm animate-pulse"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}`,
                animationDuration: `${1.3 + (i % 3) * 0.5}s`,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // 4. Spooky Jack-o'-lanterns (Autumn)
  if (type === 'spooky_pumpkins') {
    const pumpkinColors = ['#ea580c', '#f59e0b', '#c2410c', '#d97706', '#ea580c'];
    return (
      <div className="flex items-center justify-around w-full py-1 overflow-hidden opacity-90 select-none">
        {pumpkinColors.map((color, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-1 h-1 bg-emerald-950 rounded-t-sm" />
            <div
              className="w-3 h-2.5 rounded-full shadow-sm animate-pulse"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 7px ${color}`,
                animationDuration: `${1.1 + (i % 3) * 0.4}s`,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
};
