'use client';

import { ADMIN_TOKEN_KEY } from '@/lib/constants/auth';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AdminStats {
  totalUsers: number;
  totalOperations: number;
  totalLeads: number;
  workshopUsersCount?: number;
  approvedLeadsCount?: number;
}

interface SystemConfigData {
  id: string;
  activeThemeId: string;
  activeSeason: string;
  announcementBannerActive: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  altHome?: string;
  appMode: string;
  emailProvider: string;
  emailFrom: string;
  emailFromName: string;
  activeTheme?: {
    name: string;
    season: string;
    lightsStrandType: string;
  };
}

export default function NorthPoleDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [config, setConfig] = useState<SystemConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  // Workshop UI is self-hosted only (SaaS physically excludes /workshop). Hidden until the edition is known.
  const isSelfHosted = config?.appMode === 'selfhosted';

  useEffect(() => {
    async function fetchDashboardData(retryCount = 0) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
        const res = await fetch('/api/northpole/config', {
          credentials: 'include',
          headers: token ? { 'x-admin-token': token } : {},
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          setStats(json.stats);
          setConfig(json.config);
          setLoading(false);
          return;
        }
        if (retryCount < 2) {
          setTimeout(() => fetchDashboardData(retryCount + 1), 600 * (retryCount + 1));
          return;
        }
      } catch (error) {
        console.error('Failed to load admin dashboard data:', error);
        if (retryCount < 2) {
          setTimeout(() => fetchDashboardData(retryCount + 1), 600 * (retryCount + 1));
          return;
        }
      } finally {
        if (retryCount >= 2) {
          setLoading(false);
        }
      }
    }
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-kk-surface border-2 border-kk-danger/40 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2.5 w-2.5 rounded-full bg-kk-secondary animate-pulse"></span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-kk-on-success bg-kk-success px-2.5 py-0.5 rounded border border-kk-on-success/30">
              NORTH POLE COMMAND // LIVE
            </span>
          </div>
          <h1 className="text-3xl font-black text-kk-heading">
            Administrative Command Center
          </h1>
          <p className="text-xs text-kk-muted mt-1 font-mono">
            Platform telemetry, system configuration, user security clearances & email dispatcher controls.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/northpole/config"
            className="px-4 py-2.5 rounded-xl bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary font-mono text-xs font-bold transition-all shadow-md shadow-black/20"
          >
            ⚙️ Edit Config
          </Link>
          <Link
            href="/northpole/leads"
            className="px-4 py-2.5 rounded-xl bg-kk-secondary hover:bg-kk-secondary-hover text-kk-on-secondary font-mono text-xs font-bold transition-all shadow-md shadow-black/20"
          >
            🎟️ Clearance Queue
          </Link>
          {isSelfHosted && (
            <Link
              href="/workshop"
              className="px-4 py-2.5 rounded-xl bg-kk-gold hover:brightness-95 text-kk-on-gold font-mono text-xs font-black transition-all shadow-md shadow-black/20"
            >
              🧪 Workshop Lab
            </Link>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Users */}
        <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-kk-muted">TOTAL OPERATIVES</span>
            <span className="text-2xl">👥</span>
          </div>
          <div className="text-3xl font-extrabold text-kk-heading mt-3 font-mono">
            {loading ? '...' : stats?.totalUsers ?? 0}
          </div>
          <p className="text-[11px] text-kk-muted font-mono mt-1">
            Registered site user accounts
          </p>
          <div className="mt-4 pt-3 border-t border-kk-border">
            <Link href="/northpole/users" className="text-xs text-kk-brand hover:underline font-mono">
              Manage Operative Roster →
            </Link>
          </div>
        </div>

        {/* Card 2: Operations */}
        <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-kk-muted">TOTAL OPERATIONS</span>
            <span className="text-2xl">🎯</span>
          </div>
          <div className="text-3xl font-extrabold text-kk-heading mt-3 font-mono">
            {loading ? '...' : stats?.totalOperations ?? 0}
          </div>
          <p className="text-[11px] text-kk-muted font-mono mt-1">
            Exchanges created across platform
          </p>
          <div className="mt-4 pt-3 border-t border-kk-border">
            <Link href="/northpole/operations" className="text-xs text-kk-accent hover:underline font-mono">
              Review All Operations →
            </Link>
          </div>
        </div>

        {/* Card 3: Workshop Testers (self-hosted) or Alpha Clearances (SaaS) */}
        {isSelfHosted ? (
          <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border-strong shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-kk-gold-ink">WORKSHOP TESTERS</span>
              <span className="text-2xl">🧪</span>
            </div>
            <div className="text-3xl font-extrabold text-kk-gold-ink mt-3 font-mono">
              {loading ? '...' : stats?.workshopUsersCount ?? 0}
            </div>
            <p className="text-[11px] text-kk-muted font-mono mt-1">
              Operatives with <code className="text-kk-gold-ink">workshop</code> security tag
            </p>
            <div className="mt-4 pt-3 border-t border-kk-border">
              <Link href="/northpole/users?workshop=true" className="text-xs text-kk-gold-ink hover:underline font-mono">
                Filter Workshop Users →
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-kk-surface border border-kk-on-success/30 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-kk-brand">ALPHA CLEARANCES</span>
              <span className="text-2xl">🎟️</span>
            </div>
            <div className="text-3xl font-extrabold text-kk-brand mt-3 font-mono">
              {loading ? '...' : stats?.approvedLeadsCount ?? 0}
            </div>
            <p className="text-[11px] text-kk-muted font-mono mt-1">
              Approved pre-launch clearance ciphers
            </p>
            <div className="mt-4 pt-3 border-t border-kk-border">
              <Link href="/northpole/leads?status=APPROVED" className="text-xs text-kk-brand hover:underline font-mono">
                View Approved Operatives →
              </Link>
            </div>
          </div>
        )}

        {/* Card 4: Clearance Leads */}
        <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-kk-muted">WAITLIST LEADS</span>
            <span className="text-2xl">📋</span>
          </div>
          <div className="text-3xl font-extrabold text-kk-heading mt-3 font-mono">
            {loading ? '...' : stats?.totalLeads ?? 0}
          </div>
          <p className="text-[11px] text-kk-muted font-mono mt-1">
            Pre-launch waitlist registrations
          </p>
          <div className="mt-4 pt-3 border-t border-kk-border">
            <span className="text-xs text-kk-muted font-mono">
              ClearanceLead Schema
            </span>
          </div>
        </div>

      </div>

      {/* System Status & Architecture Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Active System State */}
        <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-kk-border">
            <h2 className="text-base font-bold text-kk-heading flex items-center gap-2">
              <span>⚡ Active System Configuration</span>
            </h2>
            <Link
              href="/northpole/config"
              className="text-xs text-kk-brand hover:underline font-mono font-bold"
            >
              Edit in /northpole/config →
            </Link>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-kk-inset border border-kk-border">
              <span className="text-kk-muted">ACTIVE THEME PRESET:</span>
              <span className="text-kk-brand font-bold">
                {config?.activeTheme?.name || config?.activeThemeId || 'winter_holiday'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-kk-inset border border-kk-border">
              <span className="text-kk-muted">SEASONAL ROTATION:</span>
              <span className="text-kk-accent font-bold uppercase">
                {config?.activeSeason || 'auto'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-kk-inset border border-kk-border">
              <span className="text-kk-muted">EMAIL GATEWAY:</span>
              <span className="text-kk-gold-ink font-bold uppercase">
                {config?.emailProvider || 'auto'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-kk-inset border border-kk-border">
              <span className="text-kk-muted">APPLICATION MODE:</span>
              <span className="text-kk-gold-ink font-bold uppercase">
                {config?.appMode || 'selfhosted'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-kk-inset border border-kk-border">
              <span className="text-kk-muted">MAINTENANCE MODE:</span>
              <span className={`font-bold ${config?.maintenanceMode ? 'text-kk-danger' : 'text-kk-muted'}`}>
                {config?.maintenanceMode ? 'ACTIVE (BLOCKING)' : 'DISABLED (NORMAL)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Security & Architecture Overview */}
        <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-kk-border">
            <h2 className="text-base font-bold text-kk-heading flex items-center gap-2">
              <span>🛡️ Security & Access Control Boundaries</span>
            </h2>
            <Link
              href="/northpole/knowledgebase"
              className="text-xs text-kk-accent hover:underline font-mono font-bold"
            >
              View Knowledge Base →
            </Link>
          </div>

          <div className="space-y-3 text-xs text-kk-ink">
            <div className="p-3 rounded-lg bg-kk-inset border border-kk-border space-y-1">
              <div className="font-bold text-kk-ink flex items-center gap-2">
                <span className="text-kk-danger">● /northpole/*</span>
                <span className="text-[10px] font-mono bg-kk-danger-soft text-kk-on-danger-soft px-1.5 py-0.5 rounded">AdminUser Schema</span>
              </div>
              <p className="text-kk-muted text-[11px]">
                Completely isolated administrative session cookie and database table. Normal site users cannot access or authenticate against North Pole routes.
              </p>
            </div>

            {isSelfHosted && (
              <div className="p-3 rounded-lg bg-kk-inset border border-kk-border space-y-1">
                <div className="font-bold text-kk-ink flex items-center gap-2">
                  <span className="text-kk-gold-ink">● /workshop/*</span>
                  <span className="text-[10px] font-mono bg-kk-warning text-kk-on-warning px-1.5 py-0.5 rounded">Security Tag: workshop</span>
                </div>
                <p className="text-kk-muted text-[11px]">
                  User-testing and QA testing lab. Requires authenticated user with the hidden <code className="text-kk-gold-ink">isWorkshop: true</code> flag.
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-kk-inset border border-kk-border space-y-1">
              <div className="font-bold text-kk-ink flex items-center gap-2">
                <span className="text-kk-brand">● /api/clearance & PreLaunchApproval</span>
                <span className="text-[10px] font-mono bg-kk-success text-kk-on-success px-1.5 py-0.5 rounded">Alpha Security Gateway</span>
              </div>
              <p className="text-kk-muted text-[11px]">
                Closed Alpha registration security gateway. Operatives must present an approved single-use PreLaunchApproval cipher or exchange mission invitation code.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-kk-inset border border-kk-border space-y-1">
              <div className="font-bold text-kk-ink flex items-center gap-2">
                <span className="text-kk-brand">● Zero-ENV Runtime Administration</span>
              </div>
              <p className="text-kk-muted text-[11px]">
                All site parameters, email API keys, theme tokens, and quotas are administered dynamically via the database with zero container restarts required.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
