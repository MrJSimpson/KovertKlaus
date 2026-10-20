'use client';

import { useState, useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';
import {
  compressImageToWebP,
  formatFileSize,
  CompressedImageResult,
} from '@/lib/imageCompression';

export interface AARReportEntry {
  id: string;
  userId: string;
  thankYouText?: string | null;
  photoUrl?: string | null;
  createdAt: string;
  badgeAwarded?: string | null;
  detectionStatus?: string | null;
  user: {
    id: string;
    name: string;
  };
}

interface AfterActionReportSectionProps {
  operationId: string;
  currentUserId: string;
  reports: AARReportEntry[];
  onReportPosted: () => void;
}

const SUGGESTED_NOTES = [
  'Thank you so much Secret Santa! 🎄',
  'The tactical kit is incredible! 🕶️',
  'Loved the personalized touch & wrapping! 🎁',
  'Best gift of the mission! 🌟',
];

export function AfterActionReportSection({
  operationId,
  currentUserId,
  reports,
  onReportPosted,
}: AfterActionReportSectionProps) {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [thankYouText, setThankYouText] = useState('');
  const [photoMode, setPhotoMode] = useState<'upload' | 'url'>('upload');
  const [photoUrl, setPhotoUrl] = useState('');
  
  // Compression & Upload State
  const [compressing, setCompressing] = useState(false);
  const [compressedResult, setCompressedResult] = useState<CompressedImageResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Lightbox Modal State
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  async function handleFileSelected(file: File) {
    setError('');
    setSuccessMessage('');
    setCompressing(true);

    try {
      const result = await compressImageToWebP(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.82,
        targetMimeType: 'image/webp',
      });
      setCompressedResult(result);
      setPhotoUrl(result.dataUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to compress image';
      setError(msg);
      setCompressedResult(null);
    } finally {
      setCompressing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  function handleClearPhoto() {
    setCompressedResult(null);
    setPhotoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!thankYouText.trim() && !photoUrl.trim()) {
      setError('Please provide a thank-you message or a gift photo.');
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
          photoUrl: photoUrl.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit report entry');
      }

      setSuccessMessage('🎉 After-Action Report entry published to the mission debrief!');
      setThankYouText('');
      handleClearPhoto();
      onReportPosted();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Submission failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
      {/* Section Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${theme.sectionBand}`}>
        <div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono tracking-wider ${theme.badgeCode}`}>
            🏆 Mission Debriefing
          </span>
          <h2 className="text-xl sm:text-2xl font-black mt-1 flex items-center gap-2">
            <span>📸 Operation After-Action Report (AAR)</span>
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-kk-header-nav font-mono">
          <span className="w-2 h-2 rounded-full bg-kk-header-nav motion-safe:animate-pulse" />
          <span>Completed Mission Log</span>
        </div>
      </div>

      <p className={`text-xs sm:text-sm mb-6 ${theme.textSubLabel}`}>
        The operation has concluded! All participating elves can share thank-you debriefs and post photos of their received gifts below.
      </p>

      {/* Submit Entry Card */}
      <form onSubmit={handleSubmit} className="mb-8 p-5 sm:p-6 rounded-2xl bg-kk-surface border border-kk-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-kk-muted">
            ✍️ Post Thank You & Gift Photo
          </h3>
          <span className="text-[10px] text-kk-muted font-mono">Client-Side WebP Optimized</span>
        </div>

        {error && (
          <div className={`p-3 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl text-xs font-bold bg-kk-success text-kk-on-success border border-kk-on-success/30">
            {successMessage}
          </div>
        )}

        {/* Thank You Message Area */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-kk-muted">
              Thank-You Message to your Secret Operator
            </label>
            <span className="text-[10px] text-kk-muted">{thankYouText.length}/500</span>
          </div>
          <textarea
            rows={3}
            maxLength={500}
            placeholder="e.g. Thank you so much Secret Santa! The tactical mug and toolkit are incredible! 🎄"
            value={thankYouText}
            onChange={(e) => setThankYouText(e.target.value)}
            className={`w-full border rounded-xl p-3 text-xs focus:outline-none transition-all ${theme.inputModalBg}`}
          />
          
          {/* Quick Chip Suggestions */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGGESTED_NOTES.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setThankYouText(chip)}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-kk-inset/70 text-kk-muted hover:bg-kk-inset transition-all cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Photo Input (Upload or URL Toggle) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-kk-muted">
              Gift Photo Attachment (Optional)
            </label>
            <div className="flex items-center gap-1 bg-kk-inset p-0.5 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => { setPhotoMode('upload'); handleClearPhoto(); }}
                className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                  photoMode === 'upload'
                    ? 'bg-kk-surface text-kk-ink shadow-xs'
                    : 'text-kk-muted hover:text-kk-ink'
                }`}
              >
                📁 Upload Photo
              </button>
              <button
                type="button"
                onClick={() => { setPhotoMode('url'); handleClearPhoto(); }}
                className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                  photoMode === 'url'
                    ? 'bg-kk-surface text-kk-ink shadow-xs'
                    : 'text-kk-muted hover:text-kk-ink'
                }`}
              >
                🔗 Web URL
              </button>
            </div>
          </div>

          {photoMode === 'upload' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="aar-file-upload"
              />

              {!photoUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-kk-on-success/30 bg-kk-success scale-[0.99]'
                      : 'border-kk-border hover:border-kk-on-success/30 bg-kk-surface/50'
                  }`}
                >
                  <div className="text-3xl mb-2">📸</div>
                  <p className="text-xs font-bold text-kk-muted">
                    {compressing ? 'Compressing photo to WebP...' : 'Click to snap a photo or drag & drop'}
                  </p>
                  <p className="text-[10px] text-kk-muted mt-1">
                    Auto-compressed to lightweight WebP (max 1200px, 82% quality)
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-kk-surface border border-kk-border flex flex-col sm:flex-row items-center gap-3">
                  <img
                    src={photoUrl}
                    alt="Preview"
                    className="w-24 h-24 sm:w-20 sm:h-20 object-cover rounded-xl border border-kk-border"
                  />
                  <div className="flex-1 text-xs space-y-1 text-center sm:text-left">
                    <div className="font-bold text-kk-ink flex items-center justify-center sm:justify-start gap-2">
                      <span>✅ Photo Ready</span>
                      {compressedResult && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-kk-success text-kk-on-success border border-kk-on-success/30 font-bold">
                          {compressedResult.compressionRatioPercent}% compressed ({formatFileSize(compressedResult.compressedSize)})
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-kk-muted">
                      {compressedResult
                        ? `Optimized to ${compressedResult.width}×${compressedResult.height} ${compressedResult.mimeType}`
                        : 'Web image ready for publication'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-kk-on-danger-soft bg-kk-danger-soft border border-kk-danger/40 hover:brightness-95 transition-all cursor-pointer"
                  >
                    ✕ Remove
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <input
                type="url"
                placeholder="https://example.com/gift-photo.jpg"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
              />
              {photoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={photoUrl}
                    alt="Preview"
                    className="w-12 h-12 rounded-lg object-cover border border-kk-border"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                  <span className="text-[10px] text-kk-muted font-mono truncate">Live preview loaded</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={loading || compressing}
          className={`w-full py-3 font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer ${theme.btnPrimary}`}
        >
          {loading ? 'Publishing Debrief...' : compressing ? 'Optimizing Image...' : '🚀 Publish After-Action Report'}
        </button>
      </form>

      {/* Reports Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-kk-border">
          <h3 className="text-xs font-black uppercase tracking-wider text-kk-muted">
            Agent Debriefings & Thank-Yous ({reports.length})
          </h3>
          <span className="text-[10px] text-kk-muted font-mono">Real-Time Log</span>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 rounded-2xl bg-kk-surface border border-dashed border-kk-border text-center space-y-2">
            <div className="text-3xl">🎁</div>
            <p className="text-xs font-bold text-kk-muted">
              No After-Action Reports posted yet.
            </p>
            <p className="text-[10px] text-kk-muted">
              Be the first elf to post a thank-you note or photo of your received gift!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((report) => {
              const displayName = report.user.name;
              return (
                <div
                  key={report.id}
                  className="p-5 rounded-2xl bg-kk-surface border border-kk-border shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Author & Timestamp Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-kk-success text-kk-on-success flex items-center justify-center text-xs font-bold font-mono">
                          🧝
                        </span>
                        <span className="font-extrabold text-xs text-kk-ink">
                          {displayName}
                        </span>
                        {report.badgeAwarded === 'KOVERT_KLAUS' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-kk-success text-kk-on-success border border-kk-on-success/30 text-[9px] font-mono font-bold">
                            🎅 Kovert Klaus
                          </span>
                        )}
                        {report.badgeAwarded === 'VIGILANT_ELF' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-kk-warning text-kk-on-warning border border-kk-border-strong text-[9px] font-mono font-bold">
                            🕵️ Vigilant Elf
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-kk-muted font-mono">
                        {new Date(report.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Thank You Message */}
                    {report.thankYouText && (
                      <p className="text-xs text-kk-muted italic bg-kk-surface p-3 rounded-xl border border-kk-border leading-relaxed">
                        "{report.thankYouText}"
                      </p>
                    )}
                  </div>

                  {/* Photo with Lightbox Zoom on Click */}
                  {report.photoUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setLightboxPhoto({ url: report.photoUrl!, title: `${displayName}'s Gift Photo` })}
                        className="w-full text-left group relative overflow-hidden rounded-xl border border-kk-border block cursor-zoom-in"
                      >
                        <img
                          src={report.photoUrl}
                          alt="Gift Photo"
                          className="w-full max-h-56 object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-kk-inset/0 group-hover:bg-kk-inset/30 transition-all flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-kk-ink text-xs font-bold bg-kk-surface/80 px-3 py-1 rounded-full backdrop-blur-xs transition-opacity flex items-center gap-1">
                            🔍 Zoom Photo
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-kk-ink text-xs font-bold px-2">
              <span>{lightboxPhoto.title}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="text-kk-heading hover:text-kk-ink font-extrabold text-base px-2 py-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt="Full Resolution Gift"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain border border-kk-border"
            />
          </div>
        </div>
      )}
    </div>
  );
}
