'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { APP_VERSION_LABEL } from '@/lib/version';

function getSavedAdmin(): { id: string; name: string; email: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('kovertklaus_admin_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function NorthPoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/northpole/login';

  const [admin, setAdmin] = useState<{ id: string; name: string; email: string; role: string } | null>(getSavedAdmin);
  const [loading, setLoading] = useState(!isLoginPage && !getSavedAdmin());

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    async function checkAdminSession(retryCount = 0) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
        const res = await fetch('/api/northpole/me', {
          credentials: 'include',
          headers: token ? { 'x-admin-token': token } : {},
        });

        if (res.status === 401) {
          console.warn('[NorthPole Access Denied] 401 Unauthorized');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('kovertklaus_admin_token');
            localStorage.removeItem('kovertklaus_admin_user');
          }
          window.location.href = '/northpole/login';
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (res.ok && json.authenticated && json.admin) {
          setAdmin(json.admin);
          if (typeof window !== 'undefined') {
            localStorage.setItem('kovertklaus_admin_user', JSON.stringify(json.admin));
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
            localStorage.removeItem('kovertklaus_admin_token');
            localStorage.removeItem('kovertklaus_admin_user');
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
  }, [isLoginPage]);

  async function handleLogout() {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
      await fetch('/api/northpole/me', {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });
    } catch {
      // Ignore network errors
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kovertklaus_admin_token');
        localStorage.removeItem('kovertklaus_admin_user');
      }
      window.location.href = '/northpole/login';
    }
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || !admin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono text-xs gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-red-600 to-emerald-800 flex items-center justify-center text-xl shadow-lg animate-pulse">
          🎅
        </div>
        <span>Verifying North Pole Clearance...</span>
      </div>
    );
  }

  const navItems = [
    { label: '📊 Dashboard', href: '/northpole' },
    { label: '⚙️ System Config', href: '/northpole/config' },
    { label: '👥 User Roster', href: '/northpole/users' },
    { label: '🎯 Operations', href: '/northpole/operations' },
    { label: '🎨 Themes', href: '/northpole/themes' },
    { label: '📖 Knowledge Base', href: '/northpole/knowledgebase' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Admin HUD Header */}
      <header className="border-b border-red-900/40 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/northpole" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-600 to-emerald-800 flex items-center justify-center text-lg shadow-md">
                🎅
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                  <span>NORTH POLE</span>
                  <span className="text-[10px] font-mono bg-red-950 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-bold">
                    HQ ADMIN
                  </span>
                  <span className="text-[10px] font-mono bg-slate-800 text-sky-300 border border-sky-600/40 px-1.5 py-0.5 rounded font-bold">
                    {APP_VERSION_LABEL}
                  </span>
                </span>
                <span className="text-[11px] text-gray-400 font-mono block">
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
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Quick Links & Admin Profile */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <Link
              href="/workshop"
              className="bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-lg transition-colors font-bold flex items-center gap-1"
            >
              🧪 Workshop
            </Link>

            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              Live Site
            </Link>

            <button
              onClick={handleLogout}
              className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
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
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs font-mono text-gray-600">
        KovertKlaus North Pole Administration // Database Isolated RBAC // Version 2.0
      </footer>
    </div>
  );
}
