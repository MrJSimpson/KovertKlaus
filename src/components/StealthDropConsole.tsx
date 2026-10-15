'use client';

import React, { useState } from 'react';
import { compressImageToWebP, formatFileSize } from '@/lib/imageCompression';

interface StealthDropConsoleProps {
  operationId: string;
  targetName?: string;
  targetAddress?: string;
  initialDropPhoto?: string | null;
  initialDropNote?: string | null;
  onDropCompleted?: (photoUrl: string, note: string) => void;
  apiActionHandler?: (payload: any) => Promise<any>;
}

export default function StealthDropConsole({
  operationId,
  targetName,
  targetAddress,
  initialDropPhoto,
  initialDropNote,
  onDropCompleted,
  apiActionHandler,
}: StealthDropConsoleProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialDropPhoto || null);
  const [stashNote, setStashNote] = useState(initialDropNote || '');
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savings, setSavings] = useState<{ orig: number; comp: number } | null>(null);
  const [isSuccess, setIsSuccess] = useState(Boolean(initialDropPhoto));
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    setCompressing(true);
    try {
      const result = await compressImageToWebP(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.82,
      });
      setPhotoUrl(result.dataUrl);
      setSavings({ orig: result.originalSize, comp: result.compressedSize });
    } catch (err: any) {
      setError(err?.message || 'Failed to compress photo');
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmitDrop(e: React.FormEvent) {
    e.preventDefault();
    if (!photoUrl) {
      setError('Please provide a drop site photo so your target can find their gift!');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      let json;
      if (apiActionHandler) {
        json = await apiActionHandler({
          action: 'submitDropProof',
          operationId,
          dropProofPhotoUrl: photoUrl,
          dropProofNote: stashNote.trim(),
        });
      } else {
        const res = await fetch('/api/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submitDropProof',
            operationId,
            dropProofPhotoUrl: photoUrl,
            dropProofNote: stashNote.trim(),
          }),
        });
        json = await res.json();
      }

      if (!json.success && json.error) {
        setError(json.error);
        setSubmitting(false);
        return;
      }

      setIsSuccess(true);
      if (onDropCompleted) onDropCompleted(photoUrl, stashNote.trim());
    } catch (err: any) {
      setError(err?.message || 'Failed to submit drop proof');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-kk-surface border border-kk-border rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-kk-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-kk-warning border border-kk-border-strong flex items-center justify-center text-xl">
            📦
          </div>
          <div>
            <div className="text-[10px] font-mono text-kk-gold-ink uppercase tracking-widest font-bold">
              KOVERT INFILTRATION CONSOLE
            </div>
            <h3 className="text-base font-bold text-kk-heading">
              Log Stealth Gift Drop
            </h3>
          </div>
        </div>

        {isSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kk-success text-kk-on-success border border-kk-on-success/30 text-xs font-mono font-bold">
            <span>✓</span> STASH LOGGED
          </span>
        )}
      </div>

      {/* Target Coordinates */}
      {targetAddress && (
        <div className="p-3.5 bg-kk-inset/80 border border-kk-border rounded-2xl flex items-start gap-2.5 text-xs font-mono text-kk-ink">
          <span className="text-kk-danger text-sm mt-0.5">📍</span>
          <div>
            <span className="text-kk-muted font-bold block text-[10px] uppercase">TARGET DROP COORDINATES:</span>
            <span className="text-kk-ink">{targetName || 'Classified Operative'} — {targetAddress}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-kk-danger-soft border border-kk-danger/40 text-kk-on-danger-soft rounded-xl text-xs font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmitDrop} className="space-y-4">
        {/* Photo Uploader */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-kk-ink font-bold">
            DROP SITE PROOF PHOTO (WEBP COMPRESSED):
          </label>

          {photoUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-kk-border bg-kk-inset">
              <img src={photoUrl} alt="Drop Site" className="w-full max-h-52 object-cover" />
              <div className="p-2.5 bg-kk-surface/90 border-t border-kk-border flex items-center justify-between text-[11px] font-mono">
                <span className="text-kk-brand font-bold flex items-center gap-1">
                  <span>✓</span> Drop Photo Loaded
                </span>
                {savings && (
                  <span className="text-kk-muted">
                    {formatFileSize(savings.comp)} (saved {Math.round((1 - savings.comp / savings.orig) * 100)}%)
                  </span>
                )}
                {!isSuccess && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl(null);
                      setSavings(null);
                    }}
                    className="text-kk-danger hover:underline font-bold cursor-pointer"
                  >
                    Change Photo
                  </button>
                )}
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-kk-border hover:border-kk-border-strong rounded-2xl bg-kk-inset/50 hover:bg-kk-inset cursor-pointer transition">
              <span className="text-3xl mb-2">📸</span>
              <span className="text-xs text-kk-ink font-mono font-bold">
                {compressing ? 'Compressing WebP...' : 'Take or Upload Drop Site Photo'}
              </span>
              <span className="text-[10px] text-kk-muted font-mono mt-1">
                Show where the gift is hidden (e.g. behind planter, on side porch)
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Location Clue */}
        <div>
          <label className="block text-xs font-mono text-kk-ink mb-1 font-bold">
            STASH LOCATION CLUE (OPTIONAL):
          </label>
          <input
            type="text"
            placeholder="e.g. Tucked behind the ceramic reindeer on the left side of the porch! 🦌"
            value={stashNote}
            onChange={(e) => setStashNote(e.target.value)}
            disabled={isSuccess}
            className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl px-4 py-2.5 text-xs text-kk-ink font-mono placeholder:text-kk-muted focus:outline-none transition disabled:opacity-60"
          />
        </div>

        {!isSuccess && (
          <button
            type="submit"
            disabled={submitting || !photoUrl}
            className="w-full py-3 rounded-xl bg-kk-primary hover:bg-kk-primary-hover disabled:opacity-40 disabled:pointer-events-none text-kk-on-primary font-mono text-xs font-bold shadow-lg shadow-black/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {submitting ? 'Logging Infiltration...' : 'Confirm Drop & Stash Clue 🕶️'}
          </button>
        )}
      </form>
    </div>
  );
}
