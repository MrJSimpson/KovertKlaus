'use client';

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { formatCodename } from '@/lib/security';

export interface AARReportEntry {
  id: string;
  userId: string;
  thankYouText?: string | null;
  photoUrl?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    codename?: string | null;
  };
}

interface AfterActionReportSectionProps {
  operationId: string;
  currentUserId: string;
  reports: AARReportEntry[];
  onReportPosted: () => void;
}

export function AfterActionReportSection({
  operationId,
  currentUserId,
  reports,
  onReportPosted,
}: AfterActionReportSectionProps) {
  const { theme } = useTheme();
  const [thankYouText, setThankYouText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!thankYouText.trim() && !photoUrl.trim()) {
      setError('Please provide a thank you message or a gift photo URL.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createReport',
          operationId,
          userId: currentUserId,
          thankYouText: thankYouText.trim(),
          photoUrl: photoUrl.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit report entry');
      }

      setSuccessMessage('🎉 After-Action Report entry published!');
      setThankYouText('');
      setPhotoUrl('');
      onReportPosted();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Submission failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`p-6 sm:p-8 rounded-3xl border shadow-md ${theme.cardBg}`}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200 dark:border-slate-800">
        <div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
            🏆 Mission Debriefing
          </span>
          <h2 className="text-xl font-black mt-1 flex items-center gap-2">
            📸 Operation After-Action Report (AAR)
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">Completed Operation Log</span>
      </div>

      <p className={`text-xs mb-6 ${theme.textSubLabel}`}>
        The operation has concluded! Operatives can share thank-you messages and post photos of their received gifts below.
      </p>

      {/* Submit Entry Form */}
      <form onSubmit={handleSubmit} className="mb-8 p-4 rounded-2xl bg-stone-50 dark:bg-slate-900/80 border border-stone-200 dark:border-slate-800 space-y-3">
        <h3 className="text-xs font-black uppercase text-slate-500">Post Thank You & Gift Photo</h3>

        {error && (
          <div className={`p-3 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
            ✅ {successMessage}
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-500 mb-1">Thank You Message to your Secret Operator</label>
          <textarea
            rows={3}
            placeholder="e.g. Thank you so much Secret Santa! The tactical mug and tools are incredible!"
            value={thankYouText}
            onChange={(e) => setThankYouText(e.target.value)}
            className={`w-full border rounded-xl p-3 text-xs focus:outline-none ${theme.inputModalBg}`}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Gift Photo URL (Optional)</label>
          <input
            type="url"
            placeholder="https://example.com/gift-photo.jpg"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2.5 font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer ${theme.btnPrimary}`}
        >
          {loading ? 'Posting Report...' : '📸 Post After-Action Report'}
        </button>
      </form>

      {/* Reports Feed */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
          Agent Debriefings & Thank-Yous ({reports.length})
        </h3>

        {reports.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No After-Action Reports posted yet. Be the first to thank your Secret Santa!</p>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-stone-200 dark:border-slate-800 text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  🕵️ {formatCodename(report.user.codename, report.user.name)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>

              {report.thankYouText && (
                <p className="text-slate-700 dark:text-slate-300 italic bg-stone-50 dark:bg-slate-950 p-3 rounded-xl border border-stone-200 dark:border-slate-850">
                  "{report.thankYouText}"
                </p>
              )}

              {report.photoUrl && (
                <div className="pt-2">
                  <img
                    src={report.photoUrl}
                    alt="Gift Photo"
                    className="max-h-60 rounded-xl object-cover border border-stone-300 dark:border-slate-700"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
