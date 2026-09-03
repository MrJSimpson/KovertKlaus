'use client';

import React, { useState } from 'react';
import { compressImageToWebP, formatFileSize } from '@/lib/imageCompression';

interface IdentityChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  onSuccessIdentified: (result: { correct: boolean; bustedPhotoUrl?: string; bustedReason?: string }) => void;
  onFailedGuess: () => void;
  apiActionHandler?: (payload: any) => Promise<any>;
}

export default function IdentityChallengeModal({
  isOpen,
  onClose,
  operationId,
  onSuccessIdentified,
  onFailedGuess,
  apiActionHandler,
}: IdentityChallengeModalProps) {
  const [guessInput, setGuessInput] = useState('');
  const [step, setStep] = useState<'GUESS' | 'EVIDENCE_UPLOAD' | 'GUESS_FAILED'>('GUESS');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Evidence upload state
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [evidenceReason, setEvidenceReason] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [compressionSavings, setCompressionSavings] = useState<{ orig: number; comp: number } | null>(null);

  if (!isOpen) return null;

  async function handleVerifyGuess(e: React.FormEvent) {
    e.preventDefault();
    if (!guessInput.trim()) {
      setError('Please enter a first and last name for your identification.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      let json;
      if (apiActionHandler) {
        json = await apiActionHandler({
          action: 'submitIdentityChallenge',
          operationId,
          guessedName: guessInput.trim(),
        });
      } else {
        const res = await fetch('/api/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submitIdentityChallenge',
            operationId,
            guessedName: guessInput.trim(),
          }),
        });
        json = await res.json();
      }

      if (!json.success && json.error) {
        setError(json.error);
        setSubmitting(false);
        return;
      }

      if (json.correct) {
        setStep('EVIDENCE_UPLOAD');
      } else {
        setStep('GUESS_FAILED');
        onFailedGuess();
      }
    } catch (err: any) {
      setError(err?.message || 'Verification request failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileSelected(file: File) {
    setError('');
    setCompressing(true);
    try {
      const result = await compressImageToWebP(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.82,
      });
      setEvidencePhoto(result.dataUrl);
      setCompressionSavings({ orig: result.originalSize, comp: result.compressedSize });
    } catch (err: any) {
      setError(err?.message || 'Image compression failed');
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmitEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!evidencePhoto) {
      setError('Please attach a Ring camera or front door photo as proof.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      let json;
      if (apiActionHandler) {
        json = await apiActionHandler({
          action: 'submitBustedEvidence',
          operationId,
          bustedPhotoUrl: evidencePhoto,
          bustedReason: evidenceReason.trim(),
        });
      } else {
        const res = await fetch('/api/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submitBustedEvidence',
            operationId,
            bustedPhotoUrl: evidencePhoto,
            bustedReason: evidenceReason.trim(),
          }),
        });
        json = await res.json();
      }

      if (!json.success && json.error) {
        setError(json.error);
        setSubmitting(false);
        return;
      }

      onSuccessIdentified({
        correct: true,
        bustedPhotoUrl: evidencePhoto,
        bustedReason: evidenceReason.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit evidence');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Step 1: 1-Guess Name Input */}
        {step === 'GUESS' && (
          <form onSubmit={handleVerifyGuess} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-red-500/10">
                📸
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-500/40 text-[10px] font-mono uppercase tracking-wider font-bold mb-1">
                  🛡️ 1-Time Identity Challenge
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Who Delivered Your Gift?
                </h2>
              </div>
            </div>

            <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-2xl text-xs text-amber-200 font-mono space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-400">
                <span>⚠️</span>
                STRICT 1-GUESS INVARIANT
              </div>
              <p className="text-amber-200/80 text-[11px] leading-relaxed font-sans">
                You only get <strong>one single guess</strong> to enter your Secret Santa&apos;s <strong>First and Last Name</strong>. If incorrect, your guess is burned and your Santa is awarded the <strong>🎅 Kovert Klaus (Unidentified Agent)</strong> victory badge.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/50 text-rose-300 rounded-xl text-xs font-mono">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1 font-bold">
                ENTER SUSPECT FULL NAME:
              </label>
              <input
                type="text"
                placeholder="e.g. Zach Simpson"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none transition"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !guessInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-40 disabled:pointer-events-none text-white font-mono text-xs font-bold shadow-lg shadow-red-600/20 flex items-center gap-2 transition cursor-pointer"
              >
                {submitting ? 'Verifying Identification...' : 'Verify Identification →'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Guess Failed Screen */}
        {step === 'GUESS_FAILED' && (
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-3xl shadow-xl shadow-rose-950">
              ❌
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">Identification Mismatch!</h3>
              <p className="text-xs text-slate-400 font-sans max-w-sm mx-auto leading-relaxed">
                That was not your Secret Santa. Your 1-time guess has been consumed. Your Santa remained completely undetected on their mission!
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-center gap-3">
              <span className="text-2xl">🎅</span>
              <div className="text-left font-mono">
                <div className="text-xs font-bold text-emerald-400">BADGE AWARDED TO SANTA:</div>
                <div className="text-[11px] text-slate-300">Kovert Klaus (Unidentified Agent)</div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition cursor-pointer"
            >
              Close Debrief
            </button>
          </div>
        )}

        {/* Step 3: Evidence Upload Screen */}
        {step === 'EVIDENCE_UPLOAD' && (
          <form onSubmit={handleSubmitEvidence} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-emerald-500/10">
                ✨
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono uppercase tracking-wider font-bold mb-1">
                  <span>✓</span> Target Confirmed!
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Upload Ring Camera Evidence
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              You correctly named your Secret Santa! Upload your Ring doorbell screenshot or camera snapshot to claim the <strong>🕵️ Vigilant Elf (Agent Identifier)</strong> badge!
            </p>

            {error && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/50 text-rose-300 rounded-xl text-xs font-mono">
                {error}
              </div>
            )}

            {/* Photo Uploader */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-slate-300 font-bold">
                RING / CAMERA EVIDENCE (WEBP COMPRESSED):
              </label>

              {evidencePhoto ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-950">
                  <img src={evidencePhoto} alt="Ring Camera Evidence" className="w-full max-h-48 object-cover" />
                  <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-emerald-400 font-bold">✓ Evidence Loaded</span>
                    {compressionSavings && (
                      <span className="text-slate-400">
                        {formatFileSize(compressionSavings.comp)} (saved {Math.round((1 - compressionSavings.comp / compressionSavings.orig) * 100)}%)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEvidencePhoto(null);
                        setCompressionSavings(null);
                      }}
                      className="text-rose-400 hover:text-rose-300 font-bold text-xs cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl bg-slate-950/50 hover:bg-slate-950 cursor-pointer transition">
                  <span className="text-3xl mb-2">📸</span>
                  <span className="text-xs text-slate-300 font-mono font-bold">
                    {compressing ? 'Compressing WebP...' : 'Click or Drag Ring Camera Snapshot'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">PNG, JPG, WebP auto-compressed</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Debrief Story */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1 font-bold">
                INTERCEPTION STORY (OPTIONAL):
              </label>
              <input
                type="text"
                placeholder="e.g. Spotted on driveway Ring cam at 7:14 PM sneaking past the planter! 🕶️"
                value={evidenceReason}
                onChange={(e) => setEvidenceReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none transition"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !evidencePhoto}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-mono text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition cursor-pointer"
              >
                {submitting ? 'Submitting Evidence...' : 'Log Evidence & Claim BUSTED! 🕵️'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
