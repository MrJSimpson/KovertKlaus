'use client';

import { useState } from 'react';
import Link from 'next/link';

type EmailType = 'invitation' | 'assignment' | 'welcome' | 'nudge' | 'broadcast' | 'clearance';

export default function WorkshopEmailBench() {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailType>('invitation');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('Agent Shadow');
  const [sending, setSending] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string } | null>(null);

  const templates = [
    { key: 'invitation', label: '1. Operation Invitation ✉️', desc: 'Recruitment invite with budget range and late pass badge.' },
    { key: 'assignment', label: '2. Target Assignment Reveal 🎯', desc: 'Classified Sattolo target reveal with shipping address.' },
    { key: 'welcome', label: '3. Operative Onboarding 🎁', desc: 'Welcome email with Master OpKit creation checklist.' },
    { key: 'nudge', label: '4. OpsLeader Nudge 🔔', desc: 'Urgent reminder before draw or shipping deadlines.' },
    { key: 'broadcast', label: '5. OpTeam Broadcast 📢', desc: 'Mission-wide encrypted announcement.' },
    { key: 'clearance', label: '6. Clearance Waitlist 📋', desc: 'Pre-launch waitlist confirmation and roster slot.' },
  ];

  async function handleSendTestDispatch() {
    if (!recipientEmail.trim()) {
      alert('Please enter a target recipient email');
      return;
    }

    setSending(true);
    setResultMsg(null);

    try {
      const res = await fetch('/api/northpole/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
        }),
      });

      const json = await res.json();
      setResultMsg({
        success: Boolean(json.success),
        text: json.message || (json.success ? 'Email dispatched successfully!' : 'Dispatch failed'),
      });
    } catch (err: any) {
      setResultMsg({
        success: false,
        text: err.message || 'Failed to dispatch email',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-purple-400 animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-purple-950/80 text-purple-300 border border-purple-500/30">
              WORKSHOP LAB // EMAIL TEMPLATE & DISPATCH BENCH
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            <span>Universal Transactional Email Simulator</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">
            Preview encrypted HTML email templates, verify responsive styling, and test-fire live dispatches across Brevo, SMTP, Resend, and Console.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workshop/draw"
            className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🎯 Sattolo
          </Link>
          <Link
            href="/workshop/lifecycle"
            className="bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            ⏰ Schedule
          </Link>
          <Link
            href="/workshop"
            className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            ← Hub
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Template Selector & Dispatch Form */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-purple-500/40 space-y-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-purple-300">
              ✉️ SELECT EMAIL TEMPLATE
            </h2>

            <div className="space-y-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.key}
                  onClick={() => setSelectedTemplate(tpl.key as EmailType)}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                    selectedTemplate === tpl.key
                      ? 'bg-purple-950 text-purple-200 border-purple-500 shadow-md'
                      : 'bg-slate-950 text-gray-400 border-slate-800 hover:border-gray-700'
                  }`}
                >
                  <div className="font-bold text-white">{tpl.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Test Dispatch Form */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-slate-800 space-y-4 font-mono text-xs">
            <h3 className="font-bold text-white uppercase tracking-wider">🚀 LIVE TEST DISPATCH</h3>
            <p className="text-gray-400 text-[11px]">
              Sends an encrypted test dispatch using the active email provider configured in North Pole HQ.
            </p>

            <div>
              <label className="block text-gray-300 font-bold mb-1">RECIPIENT EMAIL</label>
              <input
                type="email"
                placeholder="operative@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-1">OPERATIVE NAME</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>

            <button
              onClick={handleSendTestDispatch}
              disabled={sending || !recipientEmail.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md cursor-pointer"
            >
              {sending ? 'Dispatching...' : '📨 Send Test Dispatch'}
            </button>

            {resultMsg && (
              <div className={`p-3 rounded-xl text-xs ${
                resultMsg.success ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
              }`}>
                {resultMsg.success ? '✓' : '⚠️'} {resultMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Template Preview Simulation Frame */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-mono font-bold text-white flex items-center gap-2">
                <span>🖥️ ENCRYPTED DISPATCH PREVIEW</span>
              </h2>
              <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded font-bold">
                DARK THEME #090D16
              </span>
            </div>

            {/* Email Container Mockup */}
            <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-6 font-sans text-slate-100 max-w-xl mx-auto shadow-2xl space-y-6">
              
              {/* Email Header */}
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <div className="font-extrabold text-base tracking-tight text-white">KOVERTKLAUS HQ</div>
                    <div className="text-[10px] font-mono text-emerald-400">ENCRYPTED DISPATCH // CLASS-A</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-gray-400 px-2 py-1 rounded">
                  2026-AUG-20
                </span>
              </div>

              {/* Template Content Conditional Rendering */}
              {selectedTemplate === 'invitation' && (
                <div className="space-y-4">
                  <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl">
                    <span className="text-xs font-mono text-emerald-400 font-bold">MISSION INVITATION:</span>
                    <h3 className="text-lg font-bold text-white mt-1">Simpson Family Holiday Stealth Ops 2026</h3>
                    <p className="text-xs text-gray-300 mt-2">
                      Operative {recipientName}, you have been recruited by <strong>OpsLeader Joshua</strong> for this covert holiday gift exchange.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
                    <div className="flex justify-between"><span className="text-gray-400">MISSION CODE:</span><strong className="text-emerald-400">SIMPSON-2026</strong></div>
                    <div className="flex justify-between"><span className="text-gray-400">BUDGET RANGE:</span><strong className="text-amber-400">$20.00 – $50.00 USD</strong></div>
                    <div className="flex justify-between"><span className="text-gray-400">RSVP CUTOFF:</span><strong className="text-sky-400">Nov 20, 2026</strong></div>
                  </div>

                  <div className="text-center pt-2">
                    <button className="bg-emerald-600 text-white font-mono font-bold text-xs px-6 py-3 rounded-xl shadow-lg">
                      🚀 ACCEPT MISSION & JOIN ROSTER
                    </button>
                  </div>
                </div>
              )}

              {selectedTemplate === 'assignment' && (
                <div className="space-y-4">
                  <div className="bg-purple-950/40 border border-purple-500/30 p-4 rounded-xl">
                    <span className="text-xs font-mono text-purple-400 font-bold">CLASSIFIED TARGET REVEAL:</span>
                    <h3 className="text-lg font-bold text-white mt-1">Your Secret Santa Target Has Been Assigned</h3>
                    <p className="text-xs text-gray-300 mt-2">
                      Sattolo cyclic derangement is finalized. You are the classified Secret Santa for:
                    </p>
                    <div className="mt-3 p-3 bg-slate-950 border border-purple-500/40 rounded-lg text-center font-mono">
                      <div className="text-xs text-gray-400">ASSIGNED OPERATIVE:</div>
                      <div className="text-lg font-black text-amber-400">Shannon Simpson (Agent Falcon)</div>
                    </div>
                  </div>

                  <div className="text-center pt-2">
                    <button className="bg-purple-600 text-white font-mono font-bold text-xs px-6 py-3 rounded-xl shadow-lg">
                      🔍 INSPECT TARGET'S MASTER OPKIT
                    </button>
                  </div>
                </div>
              )}

              {selectedTemplate === 'welcome' && (
                <div className="space-y-4 text-xs">
                  <h3 className="text-lg font-bold text-white">Welcome to the Division, {recipientName}</h3>
                  <p className="text-gray-300">
                    Your operative account has been created. Here is your initial pre-flight checklist:
                  </p>
                  <div className="space-y-2 font-mono">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">✓ Master OpKit Initialized</div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-300">⏳ Add Courier Shipping Address</div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sky-300">⏳ Add 3+ Wished-For OpTools</div>
                  </div>
                </div>
              )}

              {selectedTemplate === 'nudge' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-xl">
                    <span className="text-xs font-mono text-amber-400 font-bold">OPSLEADER ACTION REMINDER:</span>
                    <h3 className="text-lg font-bold text-white mt-1">Shipping Deadline Approaching</h3>
                    <p className="text-gray-300 mt-2">
                      Please remember to dispatch your parcel and provide tracking details before the Dec 10 shipping deadline to retain Demerit Immunity.
                    </p>
                  </div>
                </div>
              )}

              {selectedTemplate === 'broadcast' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-sky-950/40 border border-sky-500/30 p-4 rounded-xl">
                    <span className="text-xs font-mono text-sky-400 font-bold">OPTEAM BROADCAST DISPATCH:</span>
                    <h3 className="text-lg font-bold text-white mt-1">Holiday Exchange Location Updated</h3>
                    <p className="text-gray-300 mt-2">
                      "Attention operatives: The exchange will take place at Joshua's house at 6:00 PM. Please bring your wrapped gifts!" — OpsLeader Joshua
                    </p>
                  </div>
                </div>
              )}

              {selectedTemplate === 'clearance' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs font-mono text-gray-400 font-bold">CLEARANCE WAITLIST POSITION:</span>
                    <h3 className="text-lg font-bold text-white mt-1">You Are Enrolled on the Early Access Roster</h3>
                    <p className="text-gray-300 mt-2">
                      Thank you for securing your position on the KovertKlaus waitlist. We will dispatch your activation code prior to the public holiday launch.
                    </p>
                  </div>
                </div>
              )}

              {/* Email Footer */}
              <div className="border-t border-slate-800 pt-4 text-center text-[10px] font-mono text-gray-500">
                KovertKlaus Universal Transactional Email Engine // Zero NPM External Overheads
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
