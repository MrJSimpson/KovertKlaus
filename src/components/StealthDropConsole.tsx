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
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-xl">
            📦
          </div>
          <div>
            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
              KOVERT INFILTRATION CONSOLE
            </div>
            <h3 className="text-base font-bold text-white">
              Log Stealth Gift Drop
            </h3>
          </div>
        </div>

        {isSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
            <span>✓</span> STASH LOGGED
          </span>
        )}
      </div>

      {/* Target Coordinates */}
      {targetAddress && (
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-start gap-2.5 text-xs font-mono text-slate-300">
          <span className="text-red-400 text-sm mt-0.5">📍</span>
          <div>
            <span className="text-slate-400 font-bold block text-[10px] uppercase">TARGET DROP COORDINATES:</span>
            <span className="text-white">{targetName || 'Classified Operative'} — {targetAddress}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/50 text-rose-300 rounded-xl text-xs font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmitDrop} className="space-y-4">
        {/* Photo Uploader */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-slate-300 font-bold">
            DROP SITE PROOF PHOTO (WEBP COMPRESSED):
          </label>

          {photoUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <img src={photoUrl} alt="Drop Site" className="w-full max-h-52 object-cover" />
              <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span>✓</span> Drop Photo Loaded
                </span>
                {savings && (
                  <span className="text-slate-400">
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
                    className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                  >
                    Change Photo
                  </button>
                )}
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl bg-slate-950/50 hover:bg-slate-950 cursor-pointer transition">
              <span className="text-3xl mb-2">📸</span>
              <span className="text-xs text-slate-300 font-mono font-bold">
                {compressing ? 'Compressing WebP...' : 'Take or Upload Drop Site Photo'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-1">
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
          <label className="block text-xs font-mono text-slate-300 mb-1 font-bold">
            STASH LOCATION CLUE (OPTIONAL):
          </label>
          <input
            type="text"
            placeholder="e.g. Tucked behind the ceramic reindeer on the left side of the porch! 🦌"
            value={stashNote}
            onChange={(e) => setStashNote(e.target.value)}
            disabled={isSuccess}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none transition disabled:opacity-60"
          />
        </div>

        {!isSuccess && (
          <button
            type="submit"
            disabled={submitting || !photoUrl}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 disabled:opacity-40 disabled:pointer-events-none text-white font-mono text-xs font-bold shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {submitting ? 'Logging Infiltration...' : 'Confirm Drop & Stash Clue 🕶️'}
          </button>
        )}
      </form>
    </div>
  );
}
