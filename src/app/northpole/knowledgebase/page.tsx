'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function NorthPoleKnowledgeBasePage() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: '1. Architecture & Vision 🎅', badge: 'OVERVIEW' },
    { id: 'roles', title: '2. Clearance Levels & RBAC 🛡️', badge: 'SECURITY' },
    { id: 'engine', title: '3. Exchange Engine & Invariants 🎯', badge: 'ALGORITHM' },
    { id: 'demerits', title: '4. Demerit Trust Governance ⚠️', badge: 'ACCOUNTABILITY' },
    { id: 'email', title: '5. Universal Email Gateway 📧', badge: 'EGRESS' },
    { id: 'northpole', title: '6. North Pole Administration ⚙️', badge: 'SYSADMIN' },
    { id: 'workshop', title: '7. Santa\'s Workshop QA Lab 🧪', badge: 'TESTING' },
    { id: 'config', title: '8. Minimized ENV & Runtime Settings 📊', badge: 'CONFIG' },
    { id: 'limits', title: '9. System Limits & Recovery ⚡', badge: 'TROUBLESHOOTING' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
              DOCUMENT REVISION 2.0 // MASTER SPECIFICATION
            </span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>📖 KovertKlaus Knowledge Base</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Human-readable technical specification, operational parameters, clearance roles, and failure recovery guides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/KovertKlaus_Knowledge_Base.odt"
            download="KovertKlaus_Knowledge_Base.odt"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl font-mono text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span>📥 Download LibreOffice (.odt)</span>
          </a>
        </div>
      </div>

      {/* Main Grid: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left: Section Navigator */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-2">
            TABLE OF CONTENTS
          </div>
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`w-full text-left p-3 rounded-xl border text-xs font-mono transition-all cursor-pointer flex flex-col justify-between ${
                activeSection === sec.id
                  ? 'bg-red-950/80 text-red-200 border-red-500/60 shadow-md font-bold'
                  : 'bg-slate-900 text-gray-400 border-slate-800 hover:border-gray-700 hover:text-white'
              }`}
            >
              <span>{sec.title}</span>
              <span className="text-[9px] text-gray-500 mt-1 uppercase font-normal">{sec.badge}</span>
            </button>
          ))}
        </div>

        {/* Right: Section Viewer */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 text-xs font-mono leading-relaxed text-gray-300">
          
          {/* Section 1 */}
          {activeSection === 'overview' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                1. Product Vision, Architecture & Design System
              </h2>
              <p>
                KovertKlaus combines classic holiday warmth with a playful covert intelligence theme. Operatives manage operations, assemble OpKits (wishlists), acquire OpTools (gift items), and execute Secret Santa and White Elephant gift exchanges.
              </p>
              
              <h3 className="text-sm font-bold text-emerald-400 pt-2">1.1 Dual Design Aesthetics</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                <li><strong className="text-white">Klaus Mode 🎄 (Light Theme)</strong>: Evergreen pine headers (emerald-950), holly berry buttons (red-700), warm gold accents, and clean white frames.</li>
                <li><strong className="text-white">Kovert Mode ❄️ (Dark Theme)</strong>: Midnight slate (#090d16), icy sky blue accents (sky-400), translucent glassmorphism panels, and frost borders.</li>
              </ul>

              <h3 className="text-sm font-bold text-emerald-400 pt-2">1.2 Open-Core Licensing Model (BSL 1.1)</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                <li><strong className="text-white">Free Non-Commercial Self-Hosting</strong>: 100% free for families, friends, non-profits, and home labs.</li>
                <li><strong className="text-white">Commercial Reservation</strong>: Exclusive SaaS commercial rights belong to Joshua Simpson.</li>
                <li><strong className="text-white">Anti-Enshittification Covenant</strong>: Any acquiring entity is contractually bound to maintain an open-source GPLv3 version.</li>
                <li><strong className="text-white">GPLv3 Automatic Sunset</strong>: Converts unconditionally to GNU GPLv3 upon business closure, acquisition breach, or owner demise.</li>
              </ul>
            </div>
          )}

          {/* Section 2 */}
          {activeSection === 'roles' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                2. Clearance Levels, Roles & Database Isolation
              </h2>
              <p>
                To prevent privilege escalation and ensure complete separation between regular participants and administrators:
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-emerald-400 font-bold">1. Field Agent</span> (<code className="text-gray-400">User</code> schema)
                  <p className="text-[11px] text-gray-400 mt-1">Standard participant enrolled in one or more gift exchanges. Uses <code className="text-emerald-400">kovertklaus_session</code> cookie.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-sky-400 font-bold">2. OpsLeader</span> (<code className="text-gray-400">ExchangeMember.role = ORGANIZER</code>)
                  <p className="text-[11px] text-gray-400 mt-1">Organizer of an operation. Manages timelines, invites, drawing, swaps, and broadcasts.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/40">
                  <span className="text-amber-300 font-bold">3. Workshop Operative</span> (<code className="text-gray-400">User.isWorkshop = true</code>)
                  <p className="text-[11px] text-gray-400 mt-1">QA tester authorized to run sandbox simulations, algorithm benches, and scraper diagnostics in <code className="text-amber-300">/workshop/*</code> while retaining full access to the live app.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-red-500/40">
                  <span className="text-red-400 font-bold">4. North Pole SysAdmin</span> (<code className="text-gray-400">AdminUser</code> isolated schema)
                  <p className="text-[11px] text-gray-400 mt-1">System administrator with full control over global settings, email gateways, themes, and user records via <code className="text-red-400">kovertklaus_admin_session</code> cookie.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 space-y-1 text-[11px]">
                  <span className="text-amber-300 font-bold">🎁 First-Time Install Credentials &amp; NIST Mandatory Reset</span>
                  <p className="text-gray-300">
                    KovertKlaus auto-seeds default administrator account (Username: <code className="text-emerald-400">santa</code>, Email: <code className="text-sky-300">admin@kovertklaus.com</code>, Password: <code className="text-amber-300">1sEcReTdEl!vErY</code>).
                  </p>
                  <p className="text-gray-400">
                    • <strong>NIST SP 800-63B Compliance</strong>: The default password MUST be reset before clearance is granted. Passphrases must be 12+ characters and cannot contain username/email.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section 3 */}
          {activeSection === 'engine' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                3. Exchange Engine & Algorithmic Invariants
              </h2>
              
              <h3 className="text-sm font-bold text-amber-400">3.1 5-Phase Dynamic Lifecycle</h3>
              <p className="text-gray-400">
                <code className="text-white">RECRUITING</code> ➔ <code className="text-white">SETUP / ASSIGNMENT</code> ➔ <code className="text-white">SHIPPING / EXECUTION</code> ➔ <code className="text-white">EXCHANGE EVENT</code> ➔ <code className="text-white">COMPLETED</code>
              </p>

              <h3 className="text-sm font-bold text-amber-400 pt-2">3.2 Sattolo Derangement Algorithm</h3>
              <p className="text-gray-400">
                Generates a single cycle without fixed points ($f(x) \neq x$). Prevents giving to oneself and obfuscates target chains so revealing one pair gives away zero clues about the rest of the group.
              </p>

              <h3 className="text-sm font-bold text-amber-400 pt-2">3.3 100% Bidirectional Match Exclusion Rules ($A \iff B$)</h3>
              <p className="text-gray-400">
                Symmetric two-way exclusion prevents spouses or household members from drawing each other. Blocking Agent A from Agent B automatically and symmetrically blocks Agent B from Agent A.
              </p>

              <h3 className="text-sm font-bold text-amber-400 pt-2">3.4 Mobile-First 2-Way Cascade Target Swap Invariant</h3>
              <p className="text-gray-400">
                Selecting a new target for Agent A automatically reassigns the displaced giver to Agent A's old target, preserving the fundamental invariant that <strong className="text-white">every operative gives exactly 1 gift and receives exactly 1 gift</strong>.
              </p>
            </div>
          )}

          {/* Section 4 */}
          {activeSection === 'demerits' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                4. Demerit Trust & Reliability Governance
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-gray-400">
                <li><strong className="text-emerald-400">0–2 Demerits (ACTIVE)</strong>: Full platform privileges.</li>
                <li><strong className="text-amber-400">3 Demerits (REMOTE_RESTRICTED)</strong>: Restricted to local in-person events only. Remote courier operations are blocked.</li>
                <li><strong className="text-red-400">&gt;3 Demerits (DISABLED)</strong>: Account suspended from all operations.</li>
                <li><strong className="text-white">Carrier Protection Waiver</strong>: Valid carrier tracking number automatically waives demerits if a package is lost in transit.</li>
                <li><strong className="text-white">Demerit Immunity Waiver</strong>: Verified receipt of any gift completely eliminates demerit liability.</li>
              </ul>
            </div>
          )}

          {/* Section 5 */}
          {activeSection === 'email' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                5. Universal Transactional Email Engine
              </h2>
              <p>Supports 4 pluggable dispatch adapters with zero external bundling bloat:</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-gray-400">
                <li><strong className="text-sky-400">Brevo v3 REST API</strong>: Default for Cloud SaaS and Cloudflare Workers (300 free emails/day). Native HTTPS fetch with zero npm dependencies.</li>
                <li><strong className="text-emerald-400">Direct SMTP (Nodemailer)</strong>: For self-hosted home labs, Docker containers, and local VPS servers.</li>
                <li><strong className="text-purple-400">Resend REST API</strong>: Developer transactional API.</li>
                <li><strong className="text-gray-400">Console Simulator</strong>: Offline development simulator printing stylized ASCII dispatches in terminal logs.</li>
              </ol>
            </div>
          )}

          {/* Section 6 */}
          {activeSection === 'northpole' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                6. North Pole Administration (/northpole)
              </h2>
              <p>The /northpole route allows system administrators to control all platform settings live:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                <li><strong className="text-white">/northpole</strong>: Telemetry overview & stats.</li>
                <li><strong className="text-white">/northpole/config</strong>: Seasonal theme switching, email credentials, quotas, and maintenance mode.</li>
                <li><strong className="text-white">/northpole/users</strong>: User moderation, demerits, and workshop clearance granting.</li>
                <li><strong className="text-white">/northpole/operations</strong>: Global inspection of all operations.</li>
                <li><strong className="text-white">/northpole/themes</strong>: Theme presets manager.</li>
              </ul>
            </div>
          )}

          {/* Section 7 */}
          {activeSection === 'workshop' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                7. Santa's Workshop QA Lab (/workshop)
              </h2>
              <p>Gated testing laboratory accessible to operatives with the <code className="text-amber-400">workshop</code> security tag:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                <li><strong className="text-white">/workshop/draw</strong>: Sattolo derangement and 2-way target cascade swap bench.</li>
                <li><strong className="text-white">/workshop/lifecycle</strong>: 5-Phase schedule and virtual date timeline simulator.</li>
                <li><strong className="text-white">/workshop/scraper</strong>: OpenGraph metadata scraper bench with SSRF defense.</li>
                <li><strong className="text-white">/workshop/email</strong>: Transactional email template previewer and live dispatch tester.</li>
              </ul>
            </div>
          )}

          {/* Section 8 */}
          {activeSection === 'config' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                8. Minimized ENV & Runtime Settings
              </h2>
              <p>
                To minimize footprint, <code className="text-white">.env</code> contains ONLY connection strings (<code className="text-amber-400">DATABASE_URL</code>, <code className="text-amber-400">DIRECT_URL</code>), <code className="text-amber-400">SESSION_SECRET</code>, and optional bootstrap credentials. All other settings are database-driven:
              </p>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1 text-gray-400">
                <div>• <strong className="text-white">activeThemeId</strong>: winter_holiday, spring_egg_hunt, tropic_klaus, spooky_autumn</div>
                <div>• <strong className="text-white">appMode</strong>: selfhosted | saas</div>
                <div>• <strong className="text-white">altHome</strong>: "" (App Home) | "coming_soon" (Waitlist)</div>
                <div>• <strong className="text-white">emailProvider</strong>: auto | brevo | smtp | resend | console</div>
                <div>• <strong className="text-white">freeAnnualHostAllowance</strong>: 1</div>
                <div>• <strong className="text-white">freeAnnualJoinAllowance</strong>: 3</div>
              </div>
            </div>
          )}

          {/* Section 9 */}
          {activeSection === 'limits' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                9. System Limits & Failure Recovery
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-gray-400">
                <li><strong className="text-white">Scraper Fast-Failover</strong>: 2.5 second timeout with automatic fallback to manual modal.</li>
                <li><strong className="text-white">SSRF Protection (OWASP A01)</strong>: Blocks all private IPv4/IPv6 ranges and AWS metadata endpoints.</li>
                <li><strong className="text-white">Super Admin Recovery</strong>: Setting <code className="text-white">INITIAL_ADMIN_EMAIL</code> in .env and triggering bootstrap re-creates the initial admin account.</li>
                <li><strong className="text-white">Offline Email Safety</strong>: Falls back gracefully to console simulator during offline or local network operations.</li>
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
