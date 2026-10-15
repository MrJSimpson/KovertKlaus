'use client';

import { ADMIN_TOKEN_KEY } from '@/lib/constants/auth';

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
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
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
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-kk-border">
        <div>
          <h1 className="text-2xl font-black text-kk-heading flex items-center gap-2">
            <span>🎨 Seasonal Theme & Aesthetics Engine</span>
          </h1>
          <p className="text-xs text-kk-muted font-mono mt-1">
            Browse and activate 4-Season quarterly rotation packages with custom color tokens, banners, and lights strands.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-kk-success border border-kk-on-success/30 text-kk-on-success text-xs font-mono font-bold">
          ✓ {successMsg}
        </div>
      )}

      {/* Themes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-16 text-kk-muted font-mono text-xs">
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
                    ? 'bg-kk-surface border-kk-on-success/30 shadow-xl shadow-black/20'
                    : 'bg-kk-surface/60 border-kk-border hover:border-kk-border-strong'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase bg-kk-inset text-kk-ink border border-kk-border">
                      Season: {theme.season}
                    </span>
                    {isActive && (
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase bg-kk-success text-kk-on-success border border-kk-on-success/30">
                        ● ACTIVE SYSTEM THEME
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-kk-heading mb-2">{theme.name}</h3>

                  <div className="space-y-2.5 font-mono text-xs text-kk-ink mt-4">
                    <div className="p-2.5 rounded-lg bg-kk-inset border border-kk-border">
                      <span className="text-kk-muted block text-[10px]">LIGHTS STRAND:</span>
                      <span className="text-kk-gold-ink font-bold">{theme.lightsStrandType}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-kk-inset border border-kk-border">
                      <span className="text-kk-muted block text-[10px]">LIGHT BANNER COPY:</span>
                      <span className="text-kk-ink">{theme.bannerTextLight || '—'}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-kk-inset border border-kk-border">
                      <span className="text-kk-muted block text-[10px]">DARK BANNER COPY:</span>
                      <span className="text-kk-ink">{theme.bannerTextDark || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-kk-border">
                  <button
                    onClick={() => handleActivateTheme(theme.id)}
                    disabled={isActive || activating === theme.id}
                    className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-kk-success text-kk-on-success border border-kk-on-success/30 cursor-default'
                        : 'bg-kk-surface hover:bg-kk-secondary-hover text-kk-ink'
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
