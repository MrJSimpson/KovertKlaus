'use client';

import { ADMIN_TOKEN_KEY } from '@/lib/constants/auth';
import {
  DEFAULT_PLATFORM_SETTINGS,
  isReleaseStage,
  PLATFORM_LIMIT_BOUNDS,
  RELEASE_STAGES,
  toPlatformSettings,
  type PlatformLimitKey,
  type PlatformSettings,
} from '@/lib/platform-limits';

const PLATFORM_LIMIT_KEYS = Object.keys(PLATFORM_LIMIT_BOUNDS) as PlatformLimitKey[];

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
  const [emailFrom, setEmailFrom] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
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
  // Platform limits & release stage (bounds in src/lib/platform-limits.ts; the server refuses values outside them)
  const [platform, setPlatform] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [defaultBudgetMin, setDefaultBudgetMin] = useState(0);
  const [defaultBudgetMax, setDefaultBudgetMax] = useState(50);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');

  // Live Email Testing State
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Lifecycle Scheduler State
  const [lifecycleCronEnabled, setLifecycleCronEnabled] = useState(true);
  const [lifecycleCronIntervalMinutes, setLifecycleCronIntervalMinutes] = useState(60);
  const [lastLifecycleRunAt, setLastLifecycleRunAt] = useState<string | null>(null);
  const [lastLifecycleTransitions, setLastLifecycleTransitions] = useState<number>(0);
  const [triggeringLifecycle, setTriggeringLifecycle] = useState(false);
  const [lifecycleTriggerResult, setLifecycleTriggerResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchConfig(retryCount = 0) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
        const res = await fetch('/api/northpole/config', {
          credentials: 'include',
          headers: token ? { 'x-admin-token': token } : {},
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          const cfg = json.config || {};
          setThemes(json.themes || []);
          setActiveThemeId(cfg.activeThemeId || 'winter_holiday');
          setActiveSeason(cfg.activeSeason || 'auto');
          setAnnouncementBannerActive(Boolean(cfg.announcementBannerActive));
          setMaintenanceMode(Boolean(cfg.maintenanceMode));
          setMaintenanceMessage(cfg.maintenanceMessage || '');
          setAltHome(cfg.altHome || '');
          setAppMode(cfg.appMode || 'selfhosted');

          setEmailProvider(cfg.emailProvider || 'auto');
          setEmailFrom(cfg.emailFrom || '');
          setEmailFromName(cfg.emailFromName || '');
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
          setPlatform(toPlatformSettings(cfg));
          setDefaultBudgetMin(Number(cfg.defaultBudgetMin ?? 0));
          setDefaultBudgetMax(Number(cfg.defaultBudgetMax ?? 50));
          setDefaultCurrency(cfg.defaultCurrency || 'USD');

          setLifecycleCronEnabled(cfg.lifecycleCronEnabled ?? true);
          setLifecycleCronIntervalMinutes(cfg.lifecycleCronIntervalMinutes ?? 60);
          setLastLifecycleRunAt(cfg.lastLifecycleRunAt || null);
          setLastLifecycleTransitions(cfg.lastLifecycleTransitions ?? 0);
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
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
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
          ...platform,
          defaultBudgetMin,
          defaultBudgetMax,
          defaultCurrency,
          lifecycleCronEnabled,
          lifecycleCronIntervalMinutes,
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

  async function handleTriggerLifecycleSweep() {
    setTriggeringLifecycle(true);
    setLifecycleTriggerResult(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch('/api/operations/lifecycle', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setLifecycleTriggerResult({
          success: true,
          message: json.message || 'Lifecycle sweep executed successfully.',
        });
        setLastLifecycleRunAt(new Date().toISOString());
        if (json.data?.transitionsCount !== undefined) {
          setLastLifecycleTransitions(json.data.transitionsCount);
        }
      } else {
        setLifecycleTriggerResult({
          success: false,
          message: json.error || 'Failed to execute lifecycle sweep.',
        });
      }
    } catch (err: any) {
      setLifecycleTriggerResult({
        success: false,
        message: err.message || 'Network error triggering lifecycle sweep.',
      });
    } finally {
      setTriggeringLifecycle(false);
    }
  }

  async function handleSendTestEmail() {
    const recipient = testEmailRecipient.trim();
    if (!recipient) {
      setTestEmailResult({ success: false, message: 'Recipient email address is required.' });
      return;
    }
    if (!recipient.includes('@') || !recipient.includes('.')) {
      setTestEmailResult({ success: false, message: 'Please provide a valid recipient email address format.' });
      return;
    }

    // Explicit validation per active provider mode
    if (emailProvider === 'brevo') {
      if (!brevoApiKey.trim()) {
        setTestEmailResult({ success: false, message: 'Brevo API Key is missing. Please enter your Brevo API key.' });
        return;
      }
      const sender = brevoSenderEmail.trim() || emailFrom.trim();
      if (!sender) {
        setTestEmailResult({ success: false, message: 'Sender Email is missing. A valid Sender Email is required for Brevo dispatch.' });
        return;
      }
    } else if (emailProvider === 'smtp') {
      if (!smtpHost.trim()) {
        setTestEmailResult({ success: false, message: 'SMTP Host is missing. Please enter your SMTP host.' });
        return;
      }
      const sender = smtpFrom.trim() || emailFrom.trim();
      if (!sender) {
        setTestEmailResult({ success: false, message: 'Sender Email is missing. A valid Sender Email is required for SMTP dispatch.' });
        return;
      }
    } else if (emailProvider === 'resend') {
      if (!resendApiKey.trim()) {
        setTestEmailResult({ success: false, message: 'Resend API Key is missing. Please enter your Resend API key.' });
        return;
      }
      const sender = emailFrom.trim();
      if (!sender) {
        setTestEmailResult({ success: false, message: 'Sender Email is missing. A valid Sender Email is required for Resend dispatch.' });
        return;
      }
    }

    setTestingEmail(true);
    setTestEmailResult(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch('/api/northpole/email/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({
          recipientEmail: recipient,
          overrideConfig: {
            provider: emailProvider as any,
            brevoApiKey: brevoApiKey.trim(),
            brevoSenderEmail: brevoSenderEmail.trim(),
            brevoSenderName: brevoSenderName.trim(),
            smtpHost: smtpHost.trim(),
            smtpPort,
            smtpUser: smtpUser.trim(),
            smtpPass: smtpPass.trim(),
            smtpSecure,
            smtpFrom: smtpFrom.trim(),
            resendApiKey: resendApiKey.trim(),
            defaultFromEmail: emailFrom.trim(),
            defaultFromName: emailFromName.trim(),
          },
        }),
      });

      const json = await res.json().catch(() => null);
      if (!json) {
        setTestEmailResult({
          success: false,
          message: `Server returned HTTP ${res.status}: ${res.statusText || 'Unable to parse server response'}`,
        });
        return;
      }
      setTestEmailResult({
        success: Boolean(json.success),
        message: json.message || (json.success ? 'Test email dispatched successfully' : (json.error || 'Dispatch failed')),
      });
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err?.message || 'Network error sending test email',
      });
    } finally {
      setTestingEmail(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 font-mono text-xs text-kk-muted">
        Loading North Pole System Parameters...
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveConfig} className="space-y-8 pb-12">
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-kk-border">
        <div>
          <h1 className="text-2xl font-black text-kk-heading flex items-center gap-2">
            <span>⚙️ System Configuration Console</span>
          </h1>
          <p className="text-xs text-kk-muted font-mono mt-1">
            Administer global theme rotation, transactional email gateways, routing & platform quotas without editing .env files.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-kk-secondary hover:bg-kk-secondary-hover disabled:opacity-50 text-kk-on-secondary font-mono text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-black/20 cursor-pointer flex items-center gap-2"
        >
          <span>{saving ? '💾 Saving Configuration...' : '💾 Save Global Settings'}</span>
        </button>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-kk-success border border-kk-on-success/30 text-kk-on-success text-xs font-mono font-bold">
          ✓ System configuration saved and activated across all runtime instances!
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-kk-danger-soft border border-kk-danger/40 text-kk-on-danger-soft text-xs font-mono">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Section 1: Seasonal Theme & Display Engine */}
      <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border space-y-6">
        <h2 className="text-base font-bold text-kk-heading flex items-center gap-2 border-b border-kk-border pb-3">
          <span>🎨 Seasonal Theme & Aesthetics Engine</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-kk-ink font-bold mb-1">ACTIVE THEME PRESET</label>
            <select
              value={activeThemeId}
              onChange={(e) => setActiveThemeId(e.target.value)}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none focus:border-kk-focus"
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.season})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-kk-muted mt-1">Controls lights strand, colors & seasonal assets.</p>
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">SEASONAL OVERRIDE</label>
            <select
              value={activeSeason}
              onChange={(e) => setActiveSeason(e.target.value)}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none focus:border-kk-focus"
            >
              <option value="auto">Auto (Detect by Theme Preset)</option>
              <option value="winter">Winter (Classic Christmas)</option>
              <option value="spring">Spring (Egg Hunt)</option>
              <option value="summer">Summer (Tropic Klaus)</option>
              <option value="autumn">Autumn (Spooky Harvest)</option>
            </select>
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">ANNOUNCEMENT BANNER</label>
            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-kk-ink">
                <input
                  type="checkbox"
                  checked={announcementBannerActive}
                  onChange={(e) => setAnnouncementBannerActive(e.target.checked)}
                  className="rounded text-kk-brand focus:ring-0"
                />
                <span>Active on Public Pages</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Routing, Mode & Maintenance */}
      <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border space-y-6">
        <h2 className="text-base font-bold text-kk-heading flex items-center gap-2 border-b border-kk-border pb-3">
          <span>🌐 Routing, App Mode & Maintenance Controls</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-kk-ink font-bold mb-1">SYSTEM ENVIRONMENT MODE</label>
            <div className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2.5 text-xs font-mono font-bold flex items-center justify-between">
              <span className={appMode === 'saas' ? 'text-kk-accent' : 'text-kk-brand'}>
                {appMode === 'saas' ? 'COMMERCIAL SAAS (Cloud)' : 'SELF-HOSTED (Docker / Home-Lab)'}
              </span>
              <span className="text-[10px] text-kk-muted bg-kk-surface px-2 py-0.5 rounded border border-kk-border">
                ENV INVARIANT
              </span>
            </div>
            <p className="text-[10px] text-kk-muted mt-1">Immutable deployment mode set via environment variables.</p>
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">ALTERNATE START PAGE (ALT_HOME)</label>
            <select
              value={altHome}
              onChange={(e) => setAltHome(e.target.value)}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none focus:border-kk-focus"
            >
              <option value="">Default App Home (Full Interactive App)</option>
              <option value="coming_soon">Coming Soon / Clearance Waitlist Landing</option>
            </select>
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">MAINTENANCE LOCKDOWN</label>
            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-kk-ink">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="rounded text-kk-danger focus:ring-0"
                />
                <span className={maintenanceMode ? 'text-kk-danger font-bold' : ''}>Enable Maintenance Mode</span>
              </label>
            </div>
          </div>
        </div>

        {maintenanceMode && (
          <div className="text-xs font-mono">
            <label className="block text-kk-ink font-bold mb-1">MAINTENANCE MESSAGE</label>
            <input
              type="text"
              placeholder="Santa's workshop is undergoing brief scheduled maintenance. We'll be back online in 15 minutes."
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              className="w-full bg-kk-inset border border-kk-danger/40 rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Section 3: Universal Transactional Email Engine */}
      <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-kk-border pb-3">
          <h2 className="text-base font-bold text-kk-heading flex items-center gap-2">
            <span>📧 Universal Transactional Email Gateway</span>
          </h2>
          <span className="text-[10px] font-mono bg-kk-inset text-kk-accent border border-kk-border-strong px-2 py-0.5 rounded font-bold">
            BREVO REST / DIRECT SMTP / RESEND / CONSOLE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-kk-ink font-bold mb-1">ACTIVE EMAIL DISPATCHER</label>
            <select
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value)}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none focus:border-kk-focus font-bold"
            >
              <option value="auto">Auto-Detect (Brevo → SMTP → Resend → Console)</option>
              <option value="brevo">Brevo REST API (Default for Cloud SaaS & Cloudflare)</option>
              <option value="smtp">Direct SMTP / Nodemailer (Self-Hosted Home Labs)</option>
              <option value="resend">Resend REST API</option>
              <option value="console">Console Simulator (Offline Development / Testing)</option>
            </select>
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">DEFAULT SENDER EMAIL (FROM)</label>
            <input
              type="email"
              placeholder="e.g. admin@kovertklaus.com"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">DEFAULT SENDER NAME</label>
            <input
              type="text"
              placeholder="e.g. KovertKlaus HQ"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>
        </div>

        {/* Option A: Brevo */}
        <div className="p-4 rounded-xl bg-kk-inset border border-kk-border space-y-3">
          <div className="text-xs font-mono font-bold text-kk-accent flex items-center justify-between">
            <span>⚡ Brevo REST API Credentials (Cloud SaaS)</span>
            <span className="text-[10px] text-kk-muted font-normal">300 free emails/day</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <label className="block text-kk-muted mb-1">BREVO API KEY</label>
              <input
                type="password"
                placeholder="e.g. xkeysib-..."
                value={brevoApiKey}
                onChange={(e) => setBrevoApiKey(e.target.value)}
                className="w-full bg-kk-surface border border-kk-border rounded-lg px-2.5 py-1.5 text-kk-ink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-kk-muted mb-1">SENDER EMAIL</label>
              <input
                type="email"
                placeholder="e.g. admin@kovertklaus.com"
                value={brevoSenderEmail}
                onChange={(e) => setBrevoSenderEmail(e.target.value)}
                className="w-full bg-kk-surface border border-kk-border rounded-lg px-2.5 py-1.5 text-kk-ink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-kk-muted mb-1">SENDER NAME</label>
              <input
                type="text"
                placeholder="e.g. KovertKlaus HQ"
                value={brevoSenderName}
                onChange={(e) => setBrevoSenderName(e.target.value)}
                className="w-full bg-kk-surface border border-kk-border rounded-lg px-2.5 py-1.5 text-kk-ink focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Option B: Direct SMTP */}
        <div className="p-4 rounded-xl bg-kk-inset border border-kk-border space-y-3">
          <div className="text-xs font-mono font-bold text-kk-brand flex items-center justify-between">
            <span>📫 Direct SMTP Settings (Self-Hosted / Home Labs)</span>
            <span className="text-[10px] text-kk-muted font-normal">Nodemailer connection</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <label className="block text-kk-muted mb-1">SMTP HOST</label>
              <input
                type="text"
                placeholder="smtp.example.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="w-full bg-kk-surface border border-kk-border rounded-lg px-2.5 py-1.5 text-kk-ink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-kk-muted mb-1">SMTP PORT</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                className="w-full bg-kk-surface border border-kk-border rounded-lg px-2.5 py-1.5 text-kk-ink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-kk-muted mb-1">SMTP USER</label>
              <input
                type="text"
                placeholder="user@example.com"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="w-full bg-kk-surface border border-kk-border rounded-lg px-2.5 py-1.5 text-kk-ink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-kk-muted mb-1">SMTP PASSWORD</label>
              <input
                type="password"
                placeholder="••••••••"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                className="w-full bg-kk-surface border border-kk-border rounded-lg px-2.5 py-1.5 text-kk-ink focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 pt-1 text-xs font-mono">
            <label className="flex items-center gap-2 cursor-pointer text-kk-ink">
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="rounded text-kk-brand focus:ring-0"
              />
              <span>SSL/TLS Secure Connection (Port 465)</span>
            </label>
          </div>
        </div>

        {/* Live Email Test Dispatcher */}
        <div className="p-4 rounded-xl bg-kk-inset border border-kk-border-strong space-y-3">
          <div className="text-xs font-mono font-bold text-kk-gold-ink">
            🧪 Live Dispatch Verifier
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="recipient@example.com for live test dispatch"
              value={testEmailRecipient}
              onChange={(e) => setTestEmailRecipient(e.target.value)}
              className="flex-1 bg-kk-surface border border-kk-border-strong rounded-xl px-3 py-2 text-xs text-kk-ink focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={testingEmail || !testEmailRecipient.trim()}
              className="bg-kk-gold hover:brightness-95 disabled:opacity-50 text-kk-on-gold font-mono text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              {testingEmail ? 'Sending...' : '📨 Send Test Dispatch'}
            </button>
          </div>

          {testEmailResult && (
            <div className={`p-2.5 rounded-lg text-xs font-mono ${
              testEmailResult.success ? 'bg-kk-success text-kk-on-success border border-kk-on-success/30' : 'bg-kk-danger-soft text-kk-on-danger-soft border border-kk-danger/40'
            }`}>
              {testEmailResult.success ? '✓' : '⚠️'} {testEmailResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Section 3b: Release Stage & Platform Limits */}
      <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border space-y-6">
        <h2 className="text-base font-bold text-kk-heading flex items-center gap-2 border-b border-kk-border pb-3">
          <span>🚦 Release Stage & Platform Limits</span>
        </h2>

        <div className="text-xs font-mono">
          <label className="block text-kk-ink font-bold mb-1">RELEASE STAGE</label>
          <select
            value={platform.releaseStage}
            onChange={(e) => setPlatform({ ...platform, releaseStage: isReleaseStage(e.target.value) ? e.target.value : platform.releaseStage })}
            className="w-full sm:w-64 bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
          >
            {RELEASE_STAGES.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
          <p className="text-kk-muted mt-1">
            ALPHA: registration needs an activation or mission invite code. BETA: anyone can register. Takes effect within a minute of saving, no redeploy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          {PLATFORM_LIMIT_KEYS.map((key) => {
            const bounds = PLATFORM_LIMIT_BOUNDS[key];
            return (
              <div key={key}>
                <label className="block text-kk-ink font-bold mb-1">{bounds.label.toUpperCase()}</label>
                <input
                  type="number"
                  min={bounds.min}
                  max={bounds.max}
                  step={1}
                  value={platform[key]}
                  onChange={(e) => setPlatform({ ...platform, [key]: Number(e.target.value) })}
                  className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
                />
                <p className="text-kk-muted mt-1">{bounds.min} to {bounds.max} (default {bounds.default})</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Public Quotas, Allowances & Pricing */}
      <div className="p-6 rounded-2xl bg-kk-surface border border-kk-border space-y-6">
        <h2 className="text-base font-bold text-kk-heading flex items-center gap-2 border-b border-kk-border pb-3">
          <span>📊 Public Limits, Fair-Use Quotas & Defaults</span>
        </h2>
        <p className="text-xs text-kk-muted">The annual allowances and paid-event price are not enforced during beta.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <label className="block text-kk-ink font-bold mb-1">FREE ANNUAL HOST ALLOWANCE</label>
            <input
              type="number"
              value={freeAnnualHostAllowance}
              onChange={(e) => setFreeAnnualHostAllowance(Number(e.target.value))}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">FREE ANNUAL JOIN ALLOWANCE</label>
            <input
              type="number"
              value={freeAnnualJoinAllowance}
              onChange={(e) => setFreeAnnualJoinAllowance(Number(e.target.value))}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">MAX FREE PARTICIPANTS</label>
            <input
              type="number"
              value={maxFreeParticipants}
              onChange={(e) => setMaxFreeParticipants(Number(e.target.value))}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">PAID EVENT PRICE (USD)</label>
            <input
              type="number"
              step="0.50"
              value={paidEventPriceUsd}
              onChange={(e) => setPaidEventPriceUsd(Number(e.target.value))}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono pt-2">
          <div>
            <label className="block text-kk-ink font-bold mb-1">DEFAULT BUDGET MIN</label>
            <input
              type="number"
              value={defaultBudgetMin}
              onChange={(e) => setDefaultBudgetMin(Number(e.target.value))}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">DEFAULT BUDGET MAX</label>
            <input
              type="number"
              value={defaultBudgetMax}
              onChange={(e) => setDefaultBudgetMax(Number(e.target.value))}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">DEFAULT CURRENCY</label>
            <input
              type="text"
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
              className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4. Automated Mission Lifecycle Engine */}
      <div className="bg-kk-surface border border-kk-border rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-mono font-bold text-kk-accent uppercase tracking-widest flex items-center gap-2">
              <span>⏱️ Mission Lifecycle Automation (Cron Engine)</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  lifecycleCronEnabled
                    ? 'bg-kk-success border-kk-on-success/30 text-kk-on-success'
                    : 'bg-kk-warning border-kk-border-strong text-kk-on-warning'
                }`}
              >
                {lifecycleCronEnabled ? 'ACTIVE' : 'PAUSED'}
              </span>
            </h2>
            <p className="text-xs text-kk-muted mt-1">
              Automatically advances missions across milestone dates (Invite Cutoff → Setup → Target Draw → Shipping → Execution).
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerLifecycleSweep}
            disabled={triggeringLifecycle}
            className="px-4 py-2 bg-kk-primary hover:bg-kk-primary-hover disabled:opacity-50 text-kk-on-primary font-mono text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-black/20"
          >
            {triggeringLifecycle ? (
              <>
                <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                <span>Sweeping...</span>
              </>
            ) : (
              <>
                <span>⚡ Run Lifecycle Sweep Now</span>
              </>
            )}
          </button>
        </div>

        {lifecycleTriggerResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
              lifecycleTriggerResult.success
                ? 'bg-kk-success border-kk-on-success/30 text-kk-on-success'
                : 'bg-kk-danger-soft border-kk-danger/40 text-kk-on-danger-soft'
            }`}
          >
            <span>{lifecycleTriggerResult.message}</span>
            <button
              type="button"
              onClick={() => setLifecycleTriggerResult(null)}
              className="text-kk-muted hover:text-kk-ink ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Telemetry HUD */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-kk-inset border border-kk-border text-xs font-mono">
          <div>
            <div className="text-kk-muted text-[10px]">CURRENT STATUS</div>
            <div className="font-bold mt-1 text-kk-ink flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  lifecycleCronEnabled ? 'bg-kk-secondary animate-pulse' : 'bg-kk-gold'
                }`}
              />
              {lifecycleCronEnabled ? 'Enabled & Scheduled' : 'Disabled (Paused)'}
            </div>
          </div>
          <div>
            <div className="text-kk-muted text-[10px]">LAST SWEEP TIMESTAMP</div>
            <div className="font-bold mt-1 text-kk-ink">
              {lastLifecycleRunAt ? new Date(lastLifecycleRunAt).toLocaleString() : 'Never Executed'}
            </div>
          </div>
          <div>
            <div className="text-kk-muted text-[10px]">LAST TRANSITIONS COUNT</div>
            <div className="font-bold mt-1 text-kk-accent">
              {lastLifecycleTransitions ?? 0} operation(s) moved
            </div>
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-kk-ink font-bold mb-2">
              <input
                type="checkbox"
                checked={lifecycleCronEnabled}
                onChange={(e) => setLifecycleCronEnabled(e.target.checked)}
                className="rounded text-kk-accent focus:ring-0"
              />
              <span>ENABLE AUTOMATED MILESTONE PROGRESSION</span>
            </label>
            <p className="text-[11px] text-kk-muted">
              When disabled, missions will not automatically advance stages on milestone dates unless manually triggered. Demerit assessment is never affected by this toggle.
            </p>
          </div>

          <div>
            <label className="block text-kk-ink font-bold mb-1">
              SWEEP INTERVAL (MINUTES)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={lifecycleCronIntervalMinutes}
                onChange={(e) => setLifecycleCronIntervalMinutes(Math.max(1, Number(e.target.value)))}
                className="w-full bg-kk-inset border border-kk-border rounded-xl px-3 py-2 text-kk-ink focus:outline-none"
              />
              <div className="flex gap-1">
                {[15, 30, 60, 1440].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setLifecycleCronIntervalMinutes(mins)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                      lifecycleCronIntervalMinutes === mins
                        ? 'bg-kk-inset border-kk-border-strong text-kk-accent'
                        : 'bg-kk-inset border-kk-border text-kk-muted hover:text-kk-ink'
                    }`}
                  >
                    {mins === 1440 ? '24h' : mins === 60 ? '1h' : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-kk-muted mt-1">
              Evaluated dynamically every 60s in self-hosted Node.js runtime and on hourly edge cron in SaaS mode.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
