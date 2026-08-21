'use client';

import { useState, useEffect } from 'react';

interface ThemeOption {
  id: string;
  name: string;
  season: string;
  lightsStrandType: string;
}

export default function NorthPoleConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [activeThemeId, setActiveThemeId] = useState('winter_holiday');
  const [activeSeason, setActiveSeason] = useState('auto');
  const [announcementBannerActive, setAnnouncementBannerActive] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [altHome, setAltHome] = useState('');
  const [appMode, setAppMode] = useState('selfhosted');

  // Email Config State
  const [emailProvider, setEmailProvider] = useState('auto');
  const [emailFrom, setEmailFrom] = useState('admin@kovertklaus.com');
  const [emailFromName, setEmailFromName] = useState('KovertKlaus HQ');
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [brevoSenderEmail, setBrevoSenderEmail] = useState('');
  const [brevoSenderName, setBrevoSenderName] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFrom, setSmtpFrom] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');

  // Limits & Quotas State
  const [freeAnnualHostAllowance, setFreeAnnualHostAllowance] = useState(1);
  const [freeAnnualJoinAllowance, setFreeAnnualJoinAllowance] = useState(3);
  const [paidEventPriceUsd, setPaidEventPriceUsd] = useState(5.0);
  const [maxFreeParticipants, setMaxFreeParticipants] = useState(25);
  const [maxWishlistItems, setMaxWishlistItems] = useState(50);
  const [defaultBudgetMin, setDefaultBudgetMin] = useState(0);
  const [defaultBudgetMax, setDefaultBudgetMax] = useState(50);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');

  // Live Email Testing State
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchConfig(retryCount = 0) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
        const res = await fetch('/api/northpole/config', {
          credentials: 'include',
          headers: token ? { 'x-admin-token': token } : {},
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          const cfg = json.config;
          setThemes(json.themes || []);
          setActiveThemeId(cfg.activeThemeId || 'winter_holiday');
          setActiveSeason(cfg.activeSeason || 'auto');
          setAnnouncementBannerActive(Boolean(cfg.announcementBannerActive));
          setMaintenanceMode(Boolean(cfg.maintenanceMode));
          setMaintenanceMessage(cfg.maintenanceMessage || '');
          setAltHome(cfg.altHome || '');
          setAppMode(cfg.appMode || 'selfhosted');

          setEmailProvider(cfg.emailProvider || 'auto');
          setEmailFrom(cfg.emailFrom || 'admin@kovertklaus.com');
          setEmailFromName(cfg.emailFromName || 'KovertKlaus HQ');
          setBrevoApiKey(cfg.brevoApiKey || '');
          setBrevoSenderEmail(cfg.brevoSenderEmail || '');
          setBrevoSenderName(cfg.brevoSenderName || '');
          setSmtpHost(cfg.smtpHost || '');
          setSmtpPort(cfg.smtpPort || 587);
          setSmtpUser(cfg.smtpUser || '');
          setSmtpPass(cfg.smtpPass || '');
          setSmtpSecure(Boolean(cfg.smtpSecure));
          setSmtpFrom(cfg.smtpFrom || '');
          setResendApiKey(cfg.resendApiKey || '');

          setFreeAnnualHostAllowance(cfg.freeAnnualHostAllowance ?? 1);
          setFreeAnnualJoinAllowance(cfg.freeAnnualJoinAllowance ?? 3);
          setPaidEventPriceUsd(Number(cfg.paidEventPriceUsd ?? 5.0));
          setMaxFreeParticipants(cfg.maxFreeParticipants ?? 25);
          setMaxWishlistItems(cfg.maxWishlistItems ?? 50);
          setDefaultBudgetMin(Number(cfg.defaultBudgetMin ?? 0));
          setDefaultBudgetMax(Number(cfg.defaultBudgetMax ?? 50));
          setDefaultCurrency(cfg.defaultCurrency || 'USD');
          setLoading(false);
          return;
        }
        if (retryCount < 2) {
          setTimeout(() => fetchConfig(retryCount + 1), 600 * (retryCount + 1));
          return;
        }
      } catch (error: any) {
        if (retryCount < 2) {
          setTimeout(() => fetchConfig(retryCount + 1), 600 * (retryCount + 1));
          return;
        }
        setErrorMessage('Failed to load system configuration');
      } finally {
        if (retryCount >= 2) {
          setLoading(false);
        }
      }
    }
    fetchConfig();
  }, []);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
      const res = await fetch('/api/northpole/config', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({
          activeThemeId,
          activeSeason,
          announcementBannerActive,
          maintenanceMode,
          maintenanceMessage,
          altHome,
          appMode,
          emailProvider,
          emailFrom,
          emailFromName,
          brevoApiKey,
          brevoSenderEmail,
          brevoSenderName,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpSecure,
          smtpFrom,
          resendApiKey,
          freeAnnualHostAllowance,
          freeAnnualJoinAllowance,
          paidEventPriceUsd,
          maxFreeParticipants,
          maxWishlistItems,
          defaultBudgetMin,
          defaultBudgetMax,
          defaultCurrency,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save configuration');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestEmail() {
    if (!testEmailRecipient.trim()) return;
    setTestingEmail(true);
    setTestEmailResult(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
      const res = await fetch('/api/northpole/email/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({
          recipientEmail: testEmailRecipient.trim(),
          overrideConfig: {
            provider: emailProvider as any,
            brevoApiKey,
            brevoSenderEmail,
            brevoSenderName,
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPass,
            smtpSecure,
            smtpFrom,
            resendApiKey,
            defaultFromEmail: emailFrom,
            defaultFromName: emailFromName,
          },
        }),
      });

      const json = await res.json();
      setTestEmailResult({
        success: Boolean(json.success),
        message: json.message || (json.success ? 'Test email dispatched successfully' : 'Dispatch failed'),
      });
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err.message || 'Network error sending test email',
      });
    } finally {
      setTestingEmail(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 font-mono text-xs text-gray-400">
        Loading North Pole System Parameters...
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveConfig} className="space-y-8 pb-12">
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>⚙️ System Configuration Console</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Administer global theme rotation, transactional email gateways, routing & platform quotas without editing .env files.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center gap-2"
        >
          <span>{saving ? '💾 Saving Configuration...' : '💾 Save Global Settings'}</span>
        </button>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold">
          ✓ System configuration saved and activated across all runtime instances!
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Section 1: Seasonal Theme & Display Engine */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <span>🎨 Seasonal Theme & Aesthetics Engine</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-bold mb-1">ACTIVE THEME PRESET</label>
            <select
              value={activeThemeId}
              onChange={(e) => setActiveThemeId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.season})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">Controls lights strand, colors & seasonal assets.</p>
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">SEASONAL OVERRIDE</label>
            <select
              value={activeSeason}
              onChange={(e) => setActiveSeason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="auto">Auto (Detect by Theme Preset)</option>
              <option value="winter">Winter (Classic Christmas)</option>
              <option value="spring">Spring (Egg Hunt)</option>
              <option value="summer">Summer (Tropic Klaus)</option>
              <option value="autumn">Autumn (Spooky Harvest)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">ANNOUNCEMENT BANNER</label>
            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={announcementBannerActive}
                  onChange={(e) => setAnnouncementBannerActive(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span>Active on Public Pages</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Routing, Mode & Maintenance */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <span>🌐 Routing, App Mode & Maintenance Controls</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-bold mb-1">APPLICATION MODE (APP_MODE)</label>
            <select
              value={appMode}
              onChange={(e) => setAppMode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="selfhosted">Self-Hosted (Unlimited Family / Home-Lab Mode)</option>
              <option value="saas">Commercial SaaS (kovertklaus.com Cloud Mode)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">ALTERNATE START PAGE (ALT_HOME)</label>
            <select
              value={altHome}
              onChange={(e) => setAltHome(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="">Default App Home (Full Interactive App)</option>
              <option value="coming_soon">Coming Soon / Clearance Waitlist Landing</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">MAINTENANCE LOCKDOWN</label>
            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="rounded text-red-500 focus:ring-0"
                />
                <span className={maintenanceMode ? 'text-red-400 font-bold' : ''}>Enable Maintenance Mode</span>
              </label>
            </div>
          </div>
        </div>

        {maintenanceMode && (
          <div className="text-xs font-mono">
            <label className="block text-gray-300 font-bold mb-1">MAINTENANCE MESSAGE</label>
            <input
              type="text"
              placeholder="Santa's workshop is undergoing brief scheduled maintenance. We'll be back online in 15 minutes."
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              className="w-full bg-slate-950 border border-red-500/40 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Section 3: Universal Transactional Email Engine */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>📧 Universal Transactional Email Gateway</span>
          </h2>
          <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded font-bold">
            BREVO REST / DIRECT SMTP / RESEND / CONSOLE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-bold mb-1">ACTIVE EMAIL DISPATCHER</label>
            <select
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-bold"
            >
              <option value="auto">Auto-Detect (Brevo → SMTP → Resend → Console)</option>
              <option value="brevo">Brevo REST API (Default for Cloud SaaS & Cloudflare)</option>
              <option value="smtp">Direct SMTP / Nodemailer (Self-Hosted Home Labs)</option>
              <option value="resend">Resend REST API</option>
              <option value="console">Console Simulator (Offline Development / Testing)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">DEFAULT SENDER EMAIL (FROM)</label>
            <input
              type="email"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">DEFAULT SENDER NAME</label>
            <input
              type="text"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Option A: Brevo */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
          <div className="text-xs font-mono font-bold text-sky-300 flex items-center justify-between">
            <span>⚡ Brevo REST API Credentials (Cloud SaaS)</span>
            <span className="text-[10px] text-gray-400 font-normal">300 free emails/day</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <label className="block text-gray-400 mb-1">BREVO API KEY</label>
              <input
                type="password"
                placeholder="xkeysib-..."
                value={brevoApiKey}
                onChange={(e) => setBrevoApiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">SENDER EMAIL</label>
              <input
                type="email"
                placeholder="admin@kovertklaus.com"
                value={brevoSenderEmail}
                onChange={(e) => setBrevoSenderEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">SENDER NAME</label>
              <input
                type="text"
                placeholder="KovertKlaus HQ"
                value={brevoSenderName}
                onChange={(e) => setBrevoSenderName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Option B: Direct SMTP */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
          <div className="text-xs font-mono font-bold text-emerald-300 flex items-center justify-between">
            <span>📫 Direct SMTP Settings (Self-Hosted / Home Labs)</span>
            <span className="text-[10px] text-gray-400 font-normal">Nodemailer connection</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <label className="block text-gray-400 mb-1">SMTP HOST</label>
              <input
                type="text"
                placeholder="smtp.example.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">SMTP PORT</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">SMTP USER</label>
              <input
                type="text"
                placeholder="user@example.com"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">SMTP PASSWORD</label>
              <input
                type="password"
                placeholder="••••••••"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 pt-1 text-xs font-mono">
            <label className="flex items-center gap-2 cursor-pointer text-gray-300">
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-0"
              />
              <span>SSL/TLS Secure Connection (Port 465)</span>
            </label>
          </div>
        </div>

        {/* Live Email Test Dispatcher */}
        <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-3">
          <div className="text-xs font-mono font-bold text-purple-300">
            🧪 Live Dispatch Verifier
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="recipient@example.com for live test dispatch"
              value={testEmailRecipient}
              onChange={(e) => setTestEmailRecipient(e.target.value)}
              className="flex-1 bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={testingEmail || !testEmailRecipient.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              {testingEmail ? 'Sending...' : '📨 Send Test Dispatch'}
            </button>
          </div>

          {testEmailResult && (
            <div className={`p-2.5 rounded-lg text-xs font-mono ${
              testEmailResult.success ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-red-950/80 text-red-300 border border-red-800'
            }`}>
              {testEmailResult.success ? '✓' : '⚠️'} {testEmailResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Public Quotas, Allowances & Pricing */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <span>📊 Public Limits, Fair-Use Quotas & Defaults</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-bold mb-1">FREE ANNUAL HOST ALLOWANCE</label>
            <input
              type="number"
              value={freeAnnualHostAllowance}
              onChange={(e) => setFreeAnnualHostAllowance(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">FREE ANNUAL JOIN ALLOWANCE</label>
            <input
              type="number"
              value={freeAnnualJoinAllowance}
              onChange={(e) => setFreeAnnualJoinAllowance(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">MAX FREE PARTICIPANTS</label>
            <input
              type="number"
              value={maxFreeParticipants}
              onChange={(e) => setMaxFreeParticipants(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">PAID EVENT PRICE (USD)</label>
            <input
              type="number"
              step="0.50"
              value={paidEventPriceUsd}
              onChange={(e) => setPaidEventPriceUsd(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono pt-2">
          <div>
            <label className="block text-gray-300 font-bold mb-1">DEFAULT BUDGET MIN</label>
            <input
              type="number"
              value={defaultBudgetMin}
              onChange={(e) => setDefaultBudgetMin(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">DEFAULT BUDGET MAX</label>
            <input
              type="number"
              value={defaultBudgetMax}
              onChange={(e) => setDefaultBudgetMax(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">DEFAULT CURRENCY</label>
            <input
              type="text"
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
