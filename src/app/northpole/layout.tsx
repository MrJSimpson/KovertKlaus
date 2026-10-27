'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { APP_VERSION_LABEL } from '@/lib/version';
import { ADMIN_TOKEN_KEY, ADMIN_USER_KEY } from '@/lib/constants/auth';

function getSavedAdmin(): { id: string; name: string; email: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function NorthPoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Login and first-run setup must render without an admin session (setup runs before any admin exists).
  const isAuthPage = pathname === '/northpole/login' || pathname === '/northpole/setup';

  const [admin, setAdmin] = useState<{ id: string; name: string; email: string; role: string } | null>(getSavedAdmin);
  const [loading, setLoading] = useState(!isAuthPage && !getSavedAdmin());
  // Workshop is self-hosted only (SaaS physically excludes /workshop). Hidden until the edition is known.
  const [isSelfHosted, setIsSelfHosted] = useState(false);

  useEffect(() => {
    // Non-blocking background pre-warming ping to ensure Neon compute is awake.
    // Its `edition` field also decides whether the self-hosted-only Workshop link is shown.
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setIsSelfHosted(json?.edition === 'selfhosted'))
      .catch(() => {});

    if (isAuthPage) {
      setLoading(false);
      return;
    }


    async function checkAdminSession(retryCount = 0) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
        const res = await fetch('/api/northpole/me', {
          credentials: 'include',
          headers: token ? { 'x-admin-token': token } : {},
        });

        if (res.status === 401) {
          console.warn('[NorthPole Access Denied] 401 Unauthorized');
          if (typeof window !== 'undefined') {
            localStorage.removeItem(ADMIN_TOKEN_KEY);
            localStorage.removeItem(ADMIN_USER_KEY);
          }
          window.location.href = '/northpole/login';
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (res.ok && json.authenticated && json.admin) {
          setAdmin(json.admin);
          if (typeof window !== 'undefined') {
            localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(json.admin));
          }
          setLoading(false);
          return;
        }

        // If server error / cold start, retry before redirecting
        if (retryCount < 2) {
          console.log(`[NorthPole Session Check] Retrying connection (${retryCount + 1}/2)...`);
          setTimeout(() => checkAdminSession(retryCount + 1), 600 * (retryCount + 1));
          return;
        }

        if (json.authenticated === false) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(ADMIN_TOKEN_KEY);
            localStorage.removeItem(ADMIN_USER_KEY);
          }
          window.location.href = '/northpole/login';
          return;
        }
      } catch (err) {
        console.error('[NorthPole Session Check Error]', err);
        if (retryCount < 2) {
          setTimeout(() => checkAdminSession(retryCount + 1), 600 * (retryCount + 1));
          return;
        }
      } finally {
        if (retryCount >= 2) {
          setLoading(false);
        }
      }
    }

    checkAdminSession();
  }, [isAuthPage]);

  async function handleLogout() {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      await fetch('/api/northpole/me', {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });
    } catch {
      // Ignore network errors
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
      }
      window.location.href = '/northpole/login';
    }
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (loading || !admin) {
    return (
      <div className="min-h-screen bg-kk-inset flex flex-col items-center justify-center text-kk-muted font-mono text-xs gap-3">
        <div className="h-10 w-10 rounded-2xl bg-kk-primary text-kk-on-primary border border-kk-border-strong flex items-center justify-center text-xl shadow-lg animate-pulse">
          🎅
        </div>
        <span>Verifying North Pole Clearance...</span>
      </div>
    );
  }

  const navItems = [
    { label: '📊 Dashboard', href: '/northpole' },
    { label: '⚙️ System Config', href: '/northpole/config' },
    { label: '🎟️ Reservations', href: '/northpole/leads' },
    { label: '📝 Feedback', href: '/northpole/feedback' },
    { label: '👥 User Roster', href: '/northpole/users' },
    { label: '🎯 Operations', href: '/northpole/operations' },
    { label: '📜 System Logs', href: '/northpole/logs' },
    { label: '🎨 Themes', href: '/northpole/themes' },
    { label: '📖 Knowledge Base', href: '/northpole/knowledgebase' },
  ];


  return (
    <div className="min-h-screen bg-kk-inset text-kk-ink font-sans flex flex-col">
      {/* Top Admin HUD Header */}
      <header className="border-b border-kk-danger/40 bg-kk-surface/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/northpole" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-kk-primary text-kk-on-primary border border-kk-border-strong flex items-center justify-center text-lg shadow-md">
                🎅
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-kk-heading flex items-center gap-2">
                  <span>NORTH POLE</span>
                  <span className="text-[10px] font-mono bg-kk-danger-soft text-kk-on-danger-soft border border-kk-danger/40 px-1.5 py-0.5 rounded font-bold">
                    HQ ADMIN
                  </span>
                  <span className="text-[10px] font-mono bg-kk-surface text-kk-accent border border-kk-border-strong px-1.5 py-0.5 rounded font-bold">
                    {APP_VERSION_LABEL}
                  </span>
                </span>
                <span className="text-[11px] text-kk-muted font-mono block">
                  KovertKlaus Administration
                </span>
              </div>
            </Link>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center flex-wrap gap-1 text-xs font-mono">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg transition-colors font-bold ${
                    isActive
                      ? 'bg-kk-primary text-kk-on-primary shadow-sm'
                      : 'text-kk-ink hover:text-kk-ink hover:bg-kk-surface'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Quick Links & Admin Profile */}
          <div className="flex items-center gap-3 text-xs font-mono">
            {isSelfHosted && (
              <Link
                href="/workshop"
                className="bg-kk-warning hover:brightness-95 text-kk-on-warning border border-kk-border-strong px-2.5 py-1.5 rounded-lg transition-colors font-bold flex items-center gap-1"
              >
                🧪 Workshop
              </Link>
            )}

            <Link
              href="/"
              className="bg-kk-surface hover:border-kk-border-strong text-kk-ink px-2.5 py-1.5 rounded-lg transition-colors"
            >
              Live Site
            </Link>

            <button
              onClick={handleLogout}
              className="bg-kk-danger-soft hover:brightness-95 text-kk-on-danger-soft border border-kk-danger/40 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        {children}
      </main>

      {/* Admin Footer */}
      <footer className="border-t border-kk-border bg-kk-inset py-6 text-center text-xs font-mono text-kk-muted">
        KovertKlaus North Pole Administration // Database Isolated RBAC // Version 2.0
      </footer>
    </div>
  );
}
