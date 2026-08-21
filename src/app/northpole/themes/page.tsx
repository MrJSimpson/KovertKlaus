'use client';

import { useState, useEffect } from 'react';

interface ThemePresetRecord {
  id: string;
  name: string;
  season: string;
  lightsStrandType: string;
  bannerTextLight?: string;
  bannerTextDark?: string;
  lightTokens?: any;
  darkTokens?: any;
}

export default function NorthPoleThemesPage() {
  const [themes, setThemes] = useState<ThemePresetRecord[]>([]);
  const [activeThemeId, setActiveThemeId] = useState('winter_holiday');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchThemes();
  }, []);

  async function fetchThemes(retryCount = 0) {
    if (retryCount === 0) setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
      const res = await fetch('/api/northpole/config', {
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setThemes(json.themes || []);
        setActiveThemeId(json.config?.activeThemeId || 'winter_holiday');
        setLoading(false);
        return;
      }
      if (retryCount < 2) {
        setTimeout(() => fetchThemes(retryCount + 1), 600 * (retryCount + 1));
        return;
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
      if (retryCount < 2) {
        setTimeout(() => fetchThemes(retryCount + 1), 600 * (retryCount + 1));
        return;
      }
    } finally {
      if (retryCount >= 2) {
        setLoading(false);
      }
    }
  }

  async function handleActivateTheme(themeId: string) {
    setActivating(themeId);
    setSuccessMsg(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
      const res = await fetch('/api/northpole/config', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({ activeThemeId: themeId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActiveThemeId(themeId);
        setSuccessMsg(`Theme activated: ${themeId} is now live across the platform!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch {
      alert('Failed to activate theme');
    } finally {
      setActivating(null);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>🎨 Seasonal Theme & Aesthetics Engine</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Browse and activate 4-Season quarterly rotation packages with custom color tokens, banners, and lights strands.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
          ✓ {successMsg}
        </div>
      )}

      {/* Themes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-16 text-gray-500 font-mono text-xs">
            Loading theme packages...
          </div>
        ) : (
          themes.map((theme) => {
            const isActive = activeThemeId === theme.id;
            return (
              <div
                key={theme.id}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                  isActive
                    ? 'bg-slate-900 border-emerald-500 shadow-xl shadow-emerald-950/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase bg-slate-950 text-gray-300 border border-slate-800">
                      Season: {theme.season}
                    </span>
                    {isActive && (
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                        ● ACTIVE SYSTEM THEME
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{theme.name}</h3>

                  <div className="space-y-2.5 font-mono text-xs text-gray-300 mt-4">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-gray-500 block text-[10px]">LIGHTS STRAND:</span>
                      <span className="text-amber-400 font-bold">{theme.lightsStrandType}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-gray-500 block text-[10px]">LIGHT BANNER COPY:</span>
                      <span className="text-gray-200">{theme.bannerTextLight || '—'}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-gray-500 block text-[10px]">DARK BANNER COPY:</span>
                      <span className="text-gray-200">{theme.bannerTextDark || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => handleActivateTheme(theme.id)}
                    disabled={isActive || activating === theme.id}
                    className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 cursor-default'
                        : 'bg-slate-800 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    {isActive
                      ? '✓ Currently Active'
                      : activating === theme.id
                      ? 'Activating...'
                      : '⚡ Activate This Theme'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
