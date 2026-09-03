'use client';

import React, { useState } from 'react';
import { generateKdmToken, isValidKdmTokenFormat, BADGE_KOVERT_KLAUS, BADGE_VIGILANT_ELF } from '@/lib/covertDelivery';
import PropertyAccessWaiverModal from '@/components/PropertyAccessWaiverModal';
import IdentityChallengeModal from '@/components/IdentityChallengeModal';
import StealthDropConsole from '@/components/StealthDropConsole';
import { AfterActionReportSection, AARReportEntry } from '@/components/AfterActionReportSection';

export default function CovertDeliveryStudioPage() {
  // Token Bench State
  const [tokens, setTokens] = useState<string[]>([
    generateKdmToken(),
    generateKdmToken(),
    generateKdmToken(),
  ]);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Waiver Modal State
  const [isWaiverOpen, setIsWaiverOpen] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  // Infiltration Simulation Squad State
  const [dropPhoto, setDropPhoto] = useState<string | null>(
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80'
  );
  const [dropNote, setDropNote] = useState('Tucked behind the large pine wreath on the front porch! 🎄');
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);
  const [guessAttempted, setGuessAttempted] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<'PENDING' | 'UNDETECTED' | 'BUSTED'>('PENDING');
  const [badgeAwarded, setBadgeAwarded] = useState<string | null>(null);
  const [bustedPhoto, setBustedPhoto] = useState<string | null>(null);
  const [bustedReason, setBustedReason] = useState<string | null>(null);

  // Mock AAR Feed
  const [mockReports, setMockReports] = useState<AARReportEntry[]>([
    {
      id: 'kdm-1',
      userId: 'user-joshua',
      thankYouText: '[🕶️ Kovert Delivery] Tactical doorstep drop executed with surgical stealth! 🕶️✨',
      photoUrl: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&auto=format&fit=crop&q=80',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      badgeAwarded: BADGE_KOVERT_KLAUS,
      detectionStatus: 'UNDETECTED',
      user: {
        id: 'user-joshua',
        name: 'Joshua Simpson',
        codename: 'Agent: Prime',
      },
    },
  ]);

  function handleGenerateNewToken() {
    setTokens((prev) => [generateKdmToken(), ...prev.slice(0, 5)]);
  }

  function handleCheckToken() {
    if (!tokenInput.trim()) {
      setTokenValid(null);
      return;
    }
    setTokenValid(isValidKdmTokenFormat(tokenInput.trim()));
  }

  // Simulated API Handler for Identity Challenge Modal in sandbox
  async function mockApiChallengeHandler(payload: any) {
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (payload.action === 'submitIdentityChallenge') {
      const guessed = (payload.guessedName || '').trim().toLowerCase();
      // Actual secret Santa is Zach Simpson
      const isCorrect = guessed.includes('zach') && guessed.includes('simpson');
      setGuessAttempted(true);

      if (isCorrect) {
        return { success: true, correct: true };
      } else {
        setDetectionStatus('UNDETECTED');
        setBadgeAwarded(BADGE_KOVERT_KLAUS);
        return { success: true, correct: false };
      }
    }

    if (payload.action === 'submitBustedEvidence') {
      setDetectionStatus('BUSTED');
      setBadgeAwarded(BADGE_VIGILANT_ELF);
      setBustedPhoto(payload.bustedPhotoUrl);
      setBustedReason(payload.bustedReason);
      return { success: true };
    }

    return { success: true };
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                KOVERT_DELIVERY
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
                LOCAL STEALTH PORCH DROP
              </span>
              <span className="px-2.5 py-1 rounded-full bg-red-950 text-red-300 border border-red-500/30 text-xs font-mono">
                RING CAM GAME
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Kovert Delivery Operation Studio 🎅🕵️
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Test single-use 12-character <code className="text-amber-400 font-mono">KDM-XXXX-XXXX-XXXX</code> invitation keys, mandatory Property Access & Non-Liability Accords, Giver Drop Site Proofing, and the target&apos;s <strong>1-Guess Real Name Identity Challenge</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDetectionStatus('PENDING');
                setBadgeAwarded(null);
                setGuessAttempted(false);
                setBustedPhoto(null);
                setBustedReason(null);
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>🔄</span> Reset Game State
            </button>
          </div>
        </div>
      </div>

      {/* Grid: 2 Primary Test Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Studio 1: KDM Token Generator & Validator */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔑</span>
              <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                1. KDM Cryptographic Token Bench
              </h2>
            </div>
            <button
              onClick={handleGenerateNewToken}
              className="px-3 py-1.5 rounded-xl bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>✨</span> Generate Key
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-mono text-slate-400 font-bold">
              ACTIVE TEST KEYS (12-HEX HIGH ENTROPY):
            </label>
            <div className="grid grid-cols-1 gap-2 font-mono text-xs">
              {tokens.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold"
                >
                  <span>{t}</span>
                  <button
                    onClick={() => {
                      setTokenInput(t);
                      setTokenValid(true);
                    }}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Test Input →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Token Regex Validator Sandbox */}
          <div className="pt-2 space-y-2 border-t border-slate-800/80">
            <label className="block text-xs font-mono text-slate-400 font-bold">
              VALIDATE TOKEN FORMAT (REGEX TEST):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. KDM-7F4A-9B2C-E3D1"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setTokenValid(null);
                }}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none"
              />
              <button
                onClick={handleCheckToken}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-mono font-bold transition cursor-pointer"
              >
                Validate
              </button>
            </div>

            {tokenValid !== null && (
              <div
                className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 ${
                  tokenValid
                    ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
                }`}
              >
                <span>{tokenValid ? '✓' : '✗'}</span>
                {tokenValid
                  ? 'Valid KDM- Token Format (12-char hex, CSPRNG compliant)'
                  : 'Invalid Token Format! Must be KDM-XXXX-XXXX-XXXX'}
              </div>
            )}
          </div>
        </div>

        {/* Studio 2: Property Access Waiver Tester */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
              <span className="text-xl">🏡</span>
              <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                2. Property Access Accord Gate
              </h2>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              All operatives joining a Kovert Delivery Operation must review and sign the 3-point legal accord granting front perimeter access, acknowledging zero trespass rules, and accepting total platform non-liability.
            </p>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">ACCORD STATUS:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full ${
                    waiverAccepted
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {waiverAccepted ? '✓ SIGNED & AUTHORIZED' : 'PENDING SIGNATURE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {waiverAccepted
                  ? 'Operative has authorized front porch access and agreed to safe conduct invariants.'
                  : 'Operative cannot participate until waiver is accepted.'}
              </p>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => setIsWaiverOpen(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-mono text-xs font-bold shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>🛡️</span>
              Open Property Access Accord Modal
            </button>
          </div>
        </div>

      </div>

      {/* Studio 3: Infiltration & 1-Guess Challenge Simulation */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center text-xl">
              📸
            </div>
            <div>
              <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold">
                SIMULATION SQUAD (SIMPSON-2026)
              </div>
              <h2 className="text-base font-bold text-white">
                3. Giver Drop Site Proof & Target Ring Cam Review
              </h2>
            </div>
          </div>

          {/* Outcome Status Pill */}
          <div className="flex items-center gap-2 font-mono text-xs">
            {detectionStatus === 'PENDING' && (
              <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-bold">
                ⏳ PENDING VERDICT
              </span>
            )}
            {detectionStatus === 'UNDETECTED' && (
              <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1.5">
                🎅 100% GHOST DROP (Santa: Zach Simpson Won)
              </span>
            )}
            {detectionStatus === 'BUSTED' && (
              <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5">
                🕵️ BUSTED ON CAMERA (Target: Joshua Simpson Won)
              </span>
            )}
          </div>
        </div>

        {/* Squad Scenario Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left: Giver Cockpit (Agent: Shadow / Zach Simpson) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-bold">GIVER OPERATIVE:</span>
              <span className="text-amber-400 font-bold">Agent: Shadow (Zach Simpson)</span>
            </div>

            <StealthDropConsole
              operationId="simpson-kdm-sandbox"
              targetName="Agent: Prime (Joshua Simpson)"
              targetAddress="123 North Pole Way, Fairbanks, AK"
              initialDropPhoto={dropPhoto}
              initialDropNote={dropNote}
              onDropCompleted={(p, n) => {
                setDropPhoto(p);
                setDropNote(n);
              }}
              apiActionHandler={async () => ({ success: true })}
            />
          </div>

          {/* Right: Target Ring Cam Review (Agent: Prime / Joshua Simpson) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 font-bold">TARGET OPERATIVE:</span>
                <span className="text-emerald-400 font-bold">Agent: Prime (Joshua Simpson)</span>
              </div>

              {/* Infiltration Alert Box */}
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-300 font-bold">
                  <span>⚠️</span> PACKAGE STASHED ON YOUR PERIMETER!
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  Your secret Santa has placed a package on your porch. Review your Ring doorbell camera footage to see if you can identify who delivered it!
                </p>
                {dropNote && (
                  <div className="text-[11px] font-mono text-amber-200/90 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <strong>Stash Clue:</strong> &quot;{dropNote}&quot;
                  </div>
                )}
              </div>

              {/* Busted Evidence Display if Busted */}
              {detectionStatus === 'BUSTED' && bustedPhoto && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/40 rounded-2xl space-y-2">
                  <div className="text-xs font-mono text-amber-300 font-bold flex items-center gap-1.5">
                    📸 RING CAMERA CAPTURE (PROVEN IDENTIFICATION):
                  </div>
                  <img src={bustedPhoto} alt="Busted Cam" className="w-full max-h-40 object-cover rounded-xl border border-amber-500/30" />
                  {bustedReason && (
                    <p className="text-[11px] font-mono text-slate-300 italic">
                      &quot;{bustedReason}&quot;
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Target Actions */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={guessAttempted || detectionStatus !== 'PENDING'}
                onClick={() => setIsChallengeOpen(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-40 disabled:pointer-events-none text-white font-mono text-xs font-bold shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>📸</span>
                Review Ring Cam & Identify Santa (1 Guess)
              </button>

              <button
                type="button"
                disabled={detectionStatus !== 'PENDING'}
                onClick={() => {
                  setDetectionStatus('UNDETECTED');
                  setBadgeAwarded(BADGE_KOVERT_KLAUS);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-300 font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="text-emerald-400 font-bold">✓</span>
                Confirm Clean Ghost Drop (Undetected)
              </button>
            </div>
          </div>

        </div>

        {/* Live AAR Feed with Kovert Delivery Badges */}
        <div className="pt-6 border-t border-slate-800/80">
          <div className="mb-4">
            <h3 className="text-xs font-mono text-amber-400 uppercase tracking-widest font-bold">
              LIVE AFTER-ACTION REPORT DEBRIEF FEED
            </h3>
            <p className="text-xs text-slate-400">
              Debrief cards automatically display <strong>🎅 Kovert Klaus</strong> (Undetected) and <strong>🕵️ Vigilant Elf</strong> (Busted) badges!
            </p>
          </div>

          <AfterActionReportSection
            operationId="simpson-kdm-sandbox"
            currentUserId="user-joshua"
            reports={mockReports}
            onReportPosted={() => {
              // Append newly submitted report
              const newReport: AARReportEntry = {
                id: `kdm-${Date.now()}`,
                userId: 'user-zach',
                thankYouText: '[🕶️ Kovert Delivery] Stealth porch drop logged from workshop studio! 🌟',
                photoUrl: dropPhoto,
                createdAt: new Date().toISOString(),
                badgeAwarded: badgeAwarded || BADGE_KOVERT_KLAUS,
                detectionStatus: detectionStatus,
                user: {
                  id: 'user-zach',
                  name: 'Zach Simpson',
                  codename: 'Agent: Shadow',
                },
              };
              setMockReports((prev) => [newReport, ...prev]);
            }}
          />
        </div>

      </div>

      {/* Modals */}
      <PropertyAccessWaiverModal
        isOpen={isWaiverOpen}
        onClose={() => setIsWaiverOpen(false)}
        onAccept={() => {
          setWaiverAccepted(true);
          setIsWaiverOpen(false);
        }}
        exchangeTitle="SIMPSON-2026 Kovert Delivery Mission"
      />

      <IdentityChallengeModal
        isOpen={isChallengeOpen}
        onClose={() => setIsChallengeOpen(false)}
        operationId="simpson-kdm-sandbox"
        apiActionHandler={mockApiChallengeHandler}
        onSuccessIdentified={(res) => {
          setDetectionStatus('BUSTED');
          setBadgeAwarded(BADGE_VIGILANT_ELF);
          setBustedPhoto(res.bustedPhotoUrl || null);
          setBustedReason(res.bustedReason || null);
        }}
        onFailedGuess={() => {
          setDetectionStatus('UNDETECTED');
          setBadgeAwarded(BADGE_KOVERT_KLAUS);
        }}
      />

    </div>
  );
}
