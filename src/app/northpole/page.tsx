'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AdminStats {
  totalUsers: number;
  totalOperations: number;
  totalLeads: number;
  workshopUsersCount: number;
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

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch('/api/northpole/config');
        const json = await res.json();
        if (res.ok && json.success) {
          setStats(json.stats);
          setConfig(json.config);
        }
      } catch (error) {
        console.error('Failed to load admin dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border-2 border-red-500/30 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/30">
              NORTH POLE COMMAND // LIVE
            </span>
          </div>
          <h1 className="text-3xl font-black text-white">
            Administrative Command Center
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Platform telemetry, system configuration, user security clearances & email dispatcher controls.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/northpole/config"
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold transition-all shadow-md shadow-red-950/40"
          >
            ⚙️ Edit Config
          </Link>
          <Link
            href="/workshop"
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono text-xs font-black transition-all shadow-md shadow-amber-950/40"
          >
            🧪 Workshop Lab
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Users */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">TOTAL OPERATIVES</span>
            <span className="text-2xl">👥</span>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {loading ? '...' : stats?.totalUsers ?? 0}
          </div>
          <p className="text-[11px] text-gray-500 font-mono mt-1">
            Registered site user accounts
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800">
            <Link href="/northpole/users" className="text-xs text-emerald-400 hover:underline font-mono">
              Manage Operative Roster →
            </Link>
          </div>
        </div>

        {/* Card 2: Operations */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">TOTAL OPERATIONS</span>
            <span className="text-2xl">🎯</span>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {loading ? '...' : stats?.totalOperations ?? 0}
          </div>
          <p className="text-[11px] text-gray-500 font-mono mt-1">
            Exchanges created across platform
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800">
            <Link href="/northpole/operations" className="text-xs text-sky-400 hover:underline font-mono">
              Review All Operations →
            </Link>
          </div>
        </div>

        {/* Card 3: Workshop Users */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/30 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-amber-300">WORKSHOP TESTERS</span>
            <span className="text-2xl">🧪</span>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-3 font-mono">
            {loading ? '...' : stats?.workshopUsersCount ?? 0}
          </div>
          <p className="text-[11px] text-gray-500 font-mono mt-1">
            Operatives with <code className="text-amber-300">workshop</code> security tag
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800">
            <Link href="/northpole/users?workshop=true" className="text-xs text-amber-400 hover:underline font-mono">
              Filter Workshop Users →
            </Link>
          </div>
        </div>

        {/* Card 4: Clearance Leads */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">WAITLIST LEADS</span>
            <span className="text-2xl">📋</span>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {loading ? '...' : stats?.totalLeads ?? 0}
          </div>
          <p className="text-[11px] text-gray-500 font-mono mt-1">
            Pre-launch waitlist registrations
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800">
            <span className="text-xs text-gray-400 font-mono">
              ClearanceLead Schema
            </span>
          </div>
        </div>

      </div>

      {/* System Status & Architecture Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Active System State */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>⚡ Active System Configuration</span>
            </h2>
            <Link
              href="/northpole/config"
              className="text-xs text-emerald-400 hover:underline font-mono font-bold"
            >
              Edit in /northpole/config →
            </Link>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-gray-400">ACTIVE THEME PRESET:</span>
              <span className="text-emerald-400 font-bold">
                {config?.activeTheme?.name || config?.activeThemeId || 'winter_holiday'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-gray-400">SEASONAL ROTATION:</span>
              <span className="text-sky-400 font-bold uppercase">
                {config?.activeSeason || 'auto'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-gray-400">EMAIL GATEWAY:</span>
              <span className="text-amber-400 font-bold uppercase">
                {config?.emailProvider || 'auto'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-gray-400">APPLICATION MODE:</span>
              <span className="text-purple-400 font-bold uppercase">
                {config?.appMode || 'selfhosted'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-gray-400">MAINTENANCE MODE:</span>
              <span className={`font-bold ${config?.maintenanceMode ? 'text-red-400' : 'text-gray-400'}`}>
                {config?.maintenanceMode ? 'ACTIVE (BLOCKING)' : 'DISABLED (NORMAL)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Security & Architecture Overview */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>🛡️ Security & Access Control Boundaries</span>
            </h2>
            <Link
              href="/northpole/knowledgebase"
              className="text-xs text-sky-400 hover:underline font-mono font-bold"
            >
              View Knowledge Base →
            </Link>
          </div>

          <div className="space-y-3 text-xs text-gray-300">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-white flex items-center gap-2">
                <span className="text-red-400">● /northpole/*</span>
                <span className="text-[10px] font-mono bg-red-950 text-red-300 px-1.5 py-0.5 rounded">AdminUser Schema</span>
              </div>
              <p className="text-gray-400 text-[11px]">
                Completely isolated administrative session cookie and database table. Normal site users cannot access or authenticate against North Pole routes.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-white flex items-center gap-2">
                <span className="text-amber-400">● /workshop/*</span>
                <span className="text-[10px] font-mono bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded">Security Tag: workshop</span>
              </div>
              <p className="text-gray-400 text-[11px]">
                User-testing and QA testing lab. Requires authenticated user with the hidden <code className="text-amber-300">isWorkshop: true</code> flag.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">● Zero-ENV Runtime Administration</span>
              </div>
              <p className="text-gray-400 text-[11px]">
                All site parameters, email API keys, theme tokens, and quotas are administered dynamically via the database with zero container restarts required.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
