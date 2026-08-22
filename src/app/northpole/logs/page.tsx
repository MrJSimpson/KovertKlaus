'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface LogEntry {
  id: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  category: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

interface LogMetrics {
  error24hCount: number;
  warn24hCount: number;
  emailFailures24hCount: number;
  totalTableCount: number;
  estimatedSizeBytes: number;
  storageCapBytes: number;
}

export default function NorthPoleLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [metrics, setMetrics] = useState<LogMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [page, setPage] = useState<number>(0);
  const pageSize = 50;

  // Inspector & Purge Modal
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [purgeDays, setPurgeDays] = useState<number>(14);
  const [purging, setPurging] = useState<boolean>(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedLevel !== 'ALL') params.set('level', selectedLevel);
      if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
      params.set('take', String(pageSize));
      params.set('skip', String(page * pageSize));

      const res = await fetch(`/api/northpole/logs?${params.toString()}`, {
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });

      if (!res.ok) {
        throw new Error(`Failed to load system logs (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotalCount(data.totalCount || 0);
        setMetrics(data.metrics || null);
      } else {
        throw new Error(data.error || 'Failed to retrieve logs');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with log telemetry gateway');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedLevel, selectedCategory, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function handlePurgeLogs(action: 'purge_by_days' | 'clear_all') {
    setPurging(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
      const res = await fetch('/api/northpole/logs', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({ action, days: purgeDays }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setPurgeMessage(json.message);
        setTimeout(() => {
          setPurgeMessage(null);
          setShowPurgeModal(false);
        }, 2000);
        fetchLogs();
      } else {
        alert(json.error || 'Failed to purge logs');
      }
    } catch (err: any) {
      alert(err.message || 'Error purging logs');
    } finally {
      setPurging(false);
    }
  }

  function handleExportJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `kovertklaus_system_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📜</span>
            <h1 className="text-2xl font-black tracking-tight text-white">System Diagnostics &amp; Telemetry Logs</h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time event stream, exception telemetry, and transactional email audit trail
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-2 transition"
          >
            <span>🔄</span> {loading ? 'Streaming...' : 'Refresh Stream'}
          </button>
          <button
            onClick={handleExportJson}
            disabled={logs.length === 0}
            className="px-3.5 py-2 rounded-xl bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-600/40 text-xs font-mono flex items-center gap-2 transition"
          >
            <span>📥</span> Export JSON
          </button>
          <button
            onClick={() => setShowPurgeModal(true)}
            className="px-3.5 py-2 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 border border-red-500/40 text-xs font-mono flex items-center gap-2 transition"
          >
            <span>🧹</span> Purge Logs
          </button>
        </div>
      </div>

      {/* KPI Metrics HUD */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/80 border border-red-900/40 rounded-2xl p-4">
            <div className="text-[11px] font-mono text-red-400 uppercase tracking-wider">Errors (24h)</div>
            <div className="text-2xl font-black text-red-300 mt-1">{metrics.error24hCount}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Actionable Exceptions</div>
          </div>

          <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-4">
            <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">Warnings (24h)</div>
            <div className="text-2xl font-black text-amber-300 mt-1">{metrics.warn24hCount}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Retries &amp; Guardrails</div>
          </div>

          <div className="bg-slate-900/80 border border-sky-900/40 rounded-2xl p-4">
            <div className="text-[11px] font-mono text-sky-400 uppercase tracking-wider">Email Errors (24h)</div>
            <div className="text-2xl font-black text-sky-300 mt-1">{metrics.emailFailures24hCount}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Brevo / SMTP Failures</div>
          </div>

          <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-4">
            <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Storage Footprint</div>
            <div className="text-xl font-black text-emerald-300 mt-1">
              {formatBytes(metrics.estimatedSizeBytes)} <span className="text-xs font-normal text-slate-400">/ 2.5 MB</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">{metrics.totalTableCount} Total Records</div>
          </div>
        </div>
      )}

      {/* Filter HUD */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="w-full md:w-96 relative">
          <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search message, endpoint path, or category..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition"
          />
        </div>

        {/* Level Tabs & Category Dropdown */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Level Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
            {['ALL', 'ERROR', 'WARN', 'INFO'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => {
                  setSelectedLevel(lvl);
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-lg transition ${
                  selectedLevel === lvl
                    ? lvl === 'ERROR'
                      ? 'bg-red-950 text-red-300 font-bold border border-red-500/40'
                      : lvl === 'WARN'
                      ? 'bg-amber-950 text-amber-300 font-bold border border-amber-500/40'
                      : lvl === 'INFO'
                      ? 'bg-sky-950 text-sky-300 font-bold border border-sky-500/40'
                      : 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="ALL">All Categories</option>
            <option value="EMAIL">EMAIL</option>
            <option value="DB">DB</option>
            <option value="AUTH">AUTH</option>
            <option value="SCRAPER">SCRAPER</option>
            <option value="WORKER">WORKER</option>
            <option value="OPERATION">OPERATION</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
      </div>

      {/* Log Feed Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center font-mono text-xs text-slate-500 flex flex-col items-center gap-3">
            <div className="h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            <span>Streaming log records...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-400 font-mono text-xs p-4">
            <span className="text-xl block mb-2">⚠️</span>
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-mono text-xs">
            <span className="text-2xl block mb-2">✨</span>
            No log events found matching the active filter criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div key={log.id} className="hover:bg-slate-800/30 transition">
                  <div
                    onClick={() => hasMetadata && setExpandedLogId(isExpanded ? null : log.id)}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      hasMetadata ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Left: Level, Category, Message */}
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      {/* Level Badge */}
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${
                          log.level === 'ERROR'
                            ? 'bg-red-950/80 text-red-300 border-red-500/40'
                            : log.level === 'WARN'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                            : log.level === 'DEBUG'
                            ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                            : 'bg-sky-950/80 text-sky-300 border-sky-500/40'
                        }`}
                      >
                        {log.level}
                      </span>

                      {/* Category Badge */}
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                        {log.category}
                      </span>

                      {/* Message */}
                      <span className="text-xs text-slate-200 font-mono truncate flex-1">
                        {log.message}
                      </span>
                    </div>

                    {/* Right: Path, Status, Time, Chevron */}
                    <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono text-slate-400">
                      {log.path && (
                        <span className="text-slate-500 truncate max-w-[150px]">
                          {log.path}
                        </span>
                      )}

                      {log.statusCode && (
                        <span
                          className={`font-bold ${
                            log.statusCode >= 500
                              ? 'text-red-400'
                              : log.statusCode >= 400
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      )}

                      <span className="text-slate-500 text-[10px]">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>

                      {hasMetadata && (
                        <span className="text-slate-600 text-xs transition-transform duration-200">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expandable JSON Inspector */}
                  {isExpanded && log.metadata && (
                    <div className="px-4 pb-4 pt-1 bg-slate-950/90 border-t border-slate-800/60 font-mono text-[11px]">
                      <div className="text-slate-500 text-[10px] mb-1.5 flex items-center justify-between">
                        <span>Structured Telemetry Metadata (Sanitized)</span>
                        <span>ID: {log.id}</span>
                      </div>
                      <pre className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-sky-300 overflow-x-auto text-[11px] leading-relaxed">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Showing {logs.length > 0 ? page * pageSize + 1 : 0} – {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <span className="px-2">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= totalCount || loading}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Purge Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <span className="text-2xl">🧹</span>
              <h2 className="text-lg font-black tracking-tight text-white">Purge Telemetry Logs</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4 font-mono">
              Free up database storage by pruning historical log records. This operation is permanent and cannot be undone.
            </p>

            <div className="space-y-3 mb-6">
              <label className="block text-xs font-mono text-slate-400">Retention Horizon</label>
              <select
                value={purgeDays}
                onChange={(e) => setPurgeDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-red-500"
              >
                <option value={7}>Purge logs older than 7 days</option>
                <option value={14}>Purge logs older than 14 days</option>
                <option value={30}>Purge logs older than 30 days</option>
              </select>
            </div>

            {purgeMessage && (
              <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 font-mono text-xs">
                {purgeMessage}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => handlePurgeLogs('clear_all')}
                disabled={purging}
                className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-950 text-red-400 border border-red-800/40 text-xs font-mono transition"
              >
                Clear All Logs
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPurgeModal(false)}
                  disabled={purging}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePurgeLogs('purge_by_days')}
                  disabled={purging}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold font-mono transition"
                >
                  {purging ? 'Purging...' : 'Purge Selected'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
