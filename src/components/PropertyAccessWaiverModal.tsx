'use client';

import React, { useState } from 'react';

interface PropertyAccessWaiverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  exchangeTitle?: string;
}

export default function PropertyAccessWaiverModal({
  isOpen,
  onClose,
  onAccept,
  exchangeTitle,
}: PropertyAccessWaiverModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-kk-surface border border-kk-border-strong rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Header Badge */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-kk-warning border border-kk-border-strong flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-black/20">
            🏡
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-kk-warning text-kk-on-warning border border-kk-border-strong text-[10px] font-mono uppercase tracking-wider font-bold mb-1">
              🛡️ Mandatory Safety Accord
            </div>
            <h2 className="text-xl font-black text-kk-heading tracking-tight">
              Property Access & Safe Conduct Agreement
            </h2>
          </div>
        </div>

        {/* Mission Notice */}
        <div className="p-3.5 bg-kk-inset/80 border border-kk-border rounded-2xl text-xs text-kk-ink font-mono space-y-1">
          <div className="text-kk-gold-ink font-bold flex items-center gap-1.5">
            <span>⚠️</span>
            KOVERT DELIVERY OPERATION: {exchangeTitle || 'Classified Holiday Mission'}
          </div>
          <p className="text-kk-muted text-[11px] leading-relaxed">
            This exchange mode is strictly intended for <strong>close friends and family</strong> participating in local stealth gift drop-offs.
          </p>
        </div>

        {/* Accord Terms */}
        <div className="space-y-3 text-xs text-kk-ink font-sans max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          <div className="p-3 bg-kk-inset/50 border border-kk-border rounded-xl space-y-1">
            <div className="font-bold text-kk-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-kk-surface text-kk-ink flex items-center justify-center text-[10px] font-mono">1</span>
              Perimeter Access Authorization
            </div>
            <p className="text-kk-muted text-[11px] leading-relaxed pl-7">
              By joining, you grant enrolled participants permission to access your exterior front walkway, driveway, and front porch solely for the purpose of discreetly placing a wrapped holiday package.
            </p>
          </div>

          <div className="p-3 bg-kk-inset/50 border border-kk-border rounded-xl space-y-1">
            <div className="font-bold text-kk-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-kk-surface text-kk-ink flex items-center justify-center text-[10px] font-mono">2</span>
              Safe Conduct & Zero Trespass Invariant
            </div>
            <p className="text-kk-muted text-[11px] leading-relaxed pl-7">
              Operatives visiting properties must do nothing other than safely deliver and document the package. Never open locked gates, enter backyards, disrupt property, or visit during unpermitted late-night hours.
            </p>
          </div>

          <div className="p-3 bg-kk-inset/50 border border-kk-border rounded-xl space-y-1">
            <div className="font-bold text-kk-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-kk-surface text-kk-ink flex items-center justify-center text-[10px] font-mono">3</span>
              Personal Responsibility & Platform Non-Liability
            </div>
            <p className="text-kk-muted text-[11px] leading-relaxed pl-7">
              Participants are individually responsible for their own actions on private property. KovertKlaus is purely a coordination utility and assumes zero liability for property visits, damage, or disputes.
            </p>
          </div>
        </div>

        {/* Consent Checkbox */}
        <label className="flex items-start gap-3 p-3.5 bg-kk-warning border border-kk-border-strong rounded-2xl cursor-pointer hover:brightness-95 transition select-none">
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-kk-border-strong text-kk-gold-ink focus:ring-kk-focus focus:ring-offset-kk-surface bg-kk-inset cursor-pointer"
          />
          <span className="text-xs text-kk-gold-ink leading-snug">
            I confirm that I am participating with trusted friends/family, authorize front perimeter access for gift drops, and agree to the Safe Conduct and Non-Liability terms.
          </span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-kk-border bg-kk-surface hover:border-kk-border-strong text-kk-ink font-mono text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasAgreed}
            onClick={onAccept}
            className="px-5 py-2.5 rounded-xl bg-kk-primary hover:bg-kk-primary-hover disabled:opacity-40 disabled:pointer-events-none text-kk-on-primary font-mono text-xs font-bold shadow-lg shadow-black/20 flex items-center gap-2 transition cursor-pointer"
          >
            <span>✓</span>
            Accept Accord & Enroll
          </button>
        </div>

      </div>
    </div>
  );
}
