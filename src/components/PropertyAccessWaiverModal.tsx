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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Header Badge */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-amber-500/10">
            🏡
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-mono uppercase tracking-wider font-bold mb-1">
              🛡️ Mandatory Safety Accord
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Property Access & Safe Conduct Agreement
            </h2>
          </div>
        </div>

        {/* Mission Notice */}
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs text-slate-300 font-mono space-y-1">
          <div className="text-amber-400 font-bold flex items-center gap-1.5">
            <span>⚠️</span>
            KOVERT DELIVERY OPERATION: {exchangeTitle || 'Classified Holiday Mission'}
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            This exchange mode is strictly intended for <strong>close friends and family</strong> participating in local stealth gift drop-offs.
          </p>
        </div>

        {/* Accord Terms */}
        <div className="space-y-3 text-xs text-slate-300 font-sans max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono">1</span>
              Perimeter Access Authorization
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed pl-7">
              By joining, you grant enrolled participants permission to access your exterior front walkway, driveway, and front porch solely for the purpose of discreetly placing a wrapped holiday package.
            </p>
          </div>

          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono">2</span>
              Safe Conduct & Zero Trespass Invariant
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed pl-7">
              Operatives visiting properties must do nothing other than safely deliver and document the package. Never open locked gates, enter backyards, disrupt property, or visit during unpermitted late-night hours.
            </p>
          </div>

          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono">3</span>
              Personal Responsibility & Platform Non-Liability
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed pl-7">
              Participants are individually responsible for their own actions on private property. KovertKlaus is purely a coordination utility and assumes zero liability for property visits, damage, or disputes.
            </p>
          </div>
        </div>

        {/* Consent Checkbox */}
        <label className="flex items-start gap-3 p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-2xl cursor-pointer hover:bg-amber-950/30 transition select-none">
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-amber-500/50 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 bg-slate-950 cursor-pointer"
          />
          <span className="text-xs text-amber-200/90 leading-snug">
            I confirm that I am participating with trusted friends/family, authorize front perimeter access for gift drops, and agree to the Safe Conduct and Non-Liability terms.
          </span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasAgreed}
            onClick={onAccept}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 disabled:opacity-40 disabled:pointer-events-none text-white font-mono text-xs font-bold shadow-lg shadow-amber-600/20 flex items-center gap-2 transition cursor-pointer"
          >
            <span>✓</span>
            Accept Accord & Enroll
          </button>
        </div>

      </div>
    </div>
  );
}
