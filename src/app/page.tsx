'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Charlie Brown Retro Glowing Christmas Lights Strand
function ChristmasLightsStrand({ isDarkMode }: { isDarkMode: boolean }) {
  const bulbs = [
    { color: 'bg-red-500 shadow-red-500/90 ring-red-400/50', delay: '0s' },
    { color: 'bg-emerald-500 shadow-emerald-500/90 ring-emerald-400/50', delay: '0.4s' },
    { color: 'bg-amber-400 shadow-amber-400/90 ring-amber-300/50', delay: '0.8s' },
    { color: 'bg-sky-400 shadow-sky-400/90 ring-sky-300/50', delay: '0.2s' },
    { color: 'bg-purple-500 shadow-purple-500/90 ring-purple-400/50', delay: '0.6s' },
    { color: 'bg-yellow-300 shadow-yellow-300/90 ring-yellow-200/50', delay: '1s' },
    { color: 'bg-rose-600 shadow-rose-600/90 ring-rose-400/50', delay: '0.3s' },
    { color: 'bg-emerald-400 shadow-emerald-400/90 ring-emerald-300/50', delay: '0.7s' },
    { color: 'bg-blue-500 shadow-blue-500/90 ring-blue-400/50', delay: '0.5s' },
    { color: 'bg-orange-500 shadow-orange-500/90 ring-orange-400/50', delay: '0.9s' },
  ];

  return (
    <div className={`w-full py-1.5 relative z-30 overflow-hidden select-none transition-colors ${
      isDarkMode ? 'bg-slate-950/80 border-b border-slate-800/80' : 'bg-transparent'
    }`}>
      {/* Hanging Wire Strand */}
      <div className={`absolute top-2 left-0 right-0 h-0.5 pointer-events-none ${
        isDarkMode ? 'bg-slate-700' : 'bg-slate-800'
      }`}></div>

      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center relative z-10">
        {Array.from({ length: 26 }).map((_, i) => {
          const bulb = bulbs[i % bulbs.length];
          return (
            <div key={i} className="flex flex-col items-center group cursor-pointer">
              {/* Wire socket */}
              <div className="w-2 h-2 bg-slate-800 border border-slate-600 rounded-t-sm z-10"></div>
              {/* Glowing Teardrop Bulb */}
              <div
                className={`w-3.5 h-5 rounded-b-full shadow-lg ring-1 transition-all animate-pulse transform group-hover:scale-125 ${bulb.color}`}
                style={{ animationDelay: bulb.delay, animationDuration: '1.6s' }}
              ></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Playful / "Charlie Brown" Cute Christmas Tree Artwork
function CharlieBrownTree({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="relative inline-flex flex-col items-center group cursor-pointer">
      <div className="text-amber-400 animate-bounce text-xl leading-none filter drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">
        ⭐
      </div>
      <div className="text-center font-black leading-none select-none text-2xl tracking-tighter filter drop-shadow-md">
        <div className="text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform">▲</div>
        <div className="text-emerald-700 dark:text-emerald-500 hover:scale-110 transition-transform -mt-2">▲▲</div>
        <div className="text-emerald-800 dark:text-emerald-600 hover:scale-110 transition-transform -mt-2.5">▲▲▲</div>
      </div>
      <div className="absolute right-1 top-6 text-[10px] animate-pulse">
        🔴
      </div>
      <div className="w-3 h-2 bg-amber-900 rounded-b-sm border-t border-amber-950 mt-0.5"></div>
      <div className="w-6 h-1 bg-amber-950 rounded-full mt-0.5 opacity-60"></div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Returning User Detection State
  const [userIsExisting, setUserIsExisting] = useState<boolean | null>(null);
  const [existingUserName, setExistingUserName] = useState('');

  // Shared Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [codename, setCodename] = useState('');

  // Exchange Specific Inputs
  const [title, setTitle] = useState('');
  const [budgetMin, setBudgetMin] = useState(25);
  const [budgetMax, setBudgetMax] = useState(50);
  const [executionDate, setExecutionDate] = useState('2026-12-25');
  const [joinCode, setJoinCode] = useState('');

  // Check Email to Detect Existing vs New User
  async function checkUserEmail(emailInput: string) {
    if (!emailInput || !emailInput.includes('@')) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), action: 'check' }),
      });
      const json = await res.json();
      if (json.success && json.exists) {
        setUserIsExisting(true);
        setExistingUserName(json.user.name);
      } else {
        setUserIsExisting(false);
        setExistingUserName('');
      }
    } catch {
      setUserIsExisting(false);
    }
  }

  // Handle Organize Exchange Submission
  async function handleCreateExchange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      let userId: string;

      if (userIsExisting) {
        // Authenticate Existing User
        const loginRes = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok || !loginData.success) {
          throw new Error(loginData.error || 'Invalid password');
        }
        userId = loginData.user.id;
      } else {
        // Register New User with 10-Character Password
        const regRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            codename: codename.trim() || undefined,
            password,
          }),
        });
        const regData = await regRes.json();
        if (!regRes.ok || !regData.success) {
          throw new Error(regData.error || 'Registration failed');
        }
        userId = regData.data.id;
      }

      // Create Operation
      const today = new Date();
      const cutoff = new Date(today.setDate(today.getDate() + 14)).toISOString().split('T')[0];
      const assign = new Date(today.setDate(today.getDate() + 15)).toISOString().split('T')[0];

      const opRes = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          config: {
            title: title.trim(),
            budgetMin: Number(budgetMin),
            budgetMax: Number(budgetMax),
            currency: 'USD',
            giftingType: 'SINGLE',
            isLocalOnly: false,
            isWhiteElephant: false,
            inviteCutoffDate: cutoff,
            assignmentDate: assign,
            executionDate,
          },
        }),
      });

      const opData = await opRes.json();
      if (!opRes.ok || !opData.success) {
        throw new Error(opData.error || 'Failed to create exchange');
      }

      setCreateModalOpen(false);
      router.push(`/exchange/${opData.data.code}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  // Handle Join Exchange Submission
  async function handleJoinExchange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const cleanCode = joinCode.trim().toUpperCase();
      if (!cleanCode) throw new Error('Please enter a valid Exchange Code');

      let userId: string;

      if (userIsExisting) {
        // Authenticate Existing User
        const loginRes = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok || !loginData.success) {
          throw new Error(loginData.error || 'Invalid password');
        }
        userId = loginData.user.id;
      } else {
        // Register New User with 10-Character Password
        const regRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            codename: codename.trim() || undefined,
            password,
          }),
        });
        const regData = await regRes.json();
        if (!regRes.ok || !regData.success) {
          throw new Error(regData.error || 'Registration failed');
        }
        userId = regData.data.id;
      }

      // Enroll User into Operation
      const joinRes = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, operationCode: cleanCode }),
      });

      const joinData = await joinRes.json();
      if (!joinRes.ok || !joinData.success) {
        if (joinData.error?.includes('already enrolled')) {
          setJoinModalOpen(false);
          router.push(`/exchange/${cleanCode}`);
          return;
        }
        throw new Error(joinData.error || 'Failed to join exchange');
      }

      setJoinModalOpen(false);
      router.push(`/exchange/${cleanCode}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function resetAuthStates() {
    setErrorMessage('');
    setUserIsExisting(null);
    setExistingUserName('');
    setEmail('');
    setPassword('');
    setName('');
    setCodename('');
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col font-sans ${
      isDarkMode
        ? 'bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950'
        : 'bg-stone-50 text-slate-900 selection:bg-red-600 selection:text-white'
    }`}>
      
      {/* Announcement Banner */}
      <div className={`text-xs py-2 px-4 text-center font-medium transition-colors ${
        isDarkMode
          ? 'bg-slate-900 text-sky-300 border-b border-sky-500/20 shadow-inner'
          : 'bg-red-600 text-white shadow-inner'
      }`}>
        <span>{isDarkMode ? '❄️ Winter Night Ops Active' : '🎄 Welcome to KovertKlaus! Organize gift exchanges in under 60 seconds.'}</span>
      </div>

      {/* Main Header */}
      <header className={`border-b transition-colors sticky top-0 z-40 backdrop-blur-md ${
        isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-stone-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md group-hover:scale-105 transition-all ${
              isDarkMode
                ? 'bg-gradient-to-br from-sky-400 via-sky-500 to-slate-700 shadow-sky-950/50'
                : 'bg-gradient-to-br from-red-600 via-red-700 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                KovertKlaus
              </span>
              <span className={`text-xs block font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                {isDarkMode ? 'Stealth Winter Exchange' : 'Simple & Fun Gift Exchanges'}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <a href="#how-it-works" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-sky-400' : 'text-slate-700 hover:text-red-600'}`}>
              How It Works
            </a>
            <a href="#benefits" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-sky-400' : 'text-slate-700 hover:text-red-600'}`}>
              Why KovertKlaus
            </a>
            <Link href="/features" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-sky-400' : 'text-slate-700 hover:text-red-600'}`}>
              Features & Specs
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Theme Mode"
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                isDarkMode
                  ? 'bg-slate-900 border-sky-500/30 text-sky-300 hover:bg-slate-800'
                  : 'bg-stone-100 border-stone-300 text-slate-700 hover:bg-stone-200'
              }`}
            >
              <span>{isDarkMode ? '🎄 Light' : '❄️ Dark (Icy)'}</span>
            </button>

            <button
              onClick={() => { resetAuthStates(); setJoinModalOpen(true); }}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer hidden sm:inline-flex items-center gap-1 ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500/40 hover:text-sky-300'
                  : 'border-emerald-700/30 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 shadow-sm'
              }`}
            >
              <span>🔑 Enter Code</span>
            </button>

            <button
              onClick={() => { resetAuthStates(); setCreateModalOpen(true); }}
              className={`font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer transform hover:-translate-y-0.5 ${
                isDarkMode
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-950/60'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25'
              }`}
            >
              + Start Exchange
            </button>
          </div>
        </div>
      </header>

      {/* Christmas Lights Strand */}
      <ChristmasLightsStrand isDarkMode={isDarkMode} />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-20 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6 text-left relative">
            <div className="flex items-center justify-between">
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 text-sky-400 border border-sky-500/30'
                  : 'bg-emerald-100/80 text-emerald-900 border border-emerald-300'
              }`}>
                <span>{isDarkMode ? '❄️ Winter Night Stealth Mode Active' : '🎅 Secret Santa & Holiday Gift Exchanges Made Effortless'}</span>
              </div>
              <div className="hidden sm:block">
                <CharlieBrownTree isDarkMode={isDarkMode} />
              </div>
            </div>

            <h1 className={`text-4xl sm:text-6xl font-black tracking-tight leading-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              The Easiest, Funnest Way to Organize <br />
              <span className={
                isDarkMode
                  ? 'bg-gradient-to-r from-sky-400 via-cyan-300 to-slate-200 bg-clip-text text-transparent'
                  : 'bg-gradient-to-r from-red-600 via-rose-600 to-emerald-800 bg-clip-text text-transparent'
              }>
                Secret Santa & Gift Exchanges
              </span>
            </h1>

            <p className={`text-lg max-w-2xl leading-relaxed ${
              isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Bring your family, friends, or co-workers together! Create a gift exchange in 60 seconds, share universal wishlists, and enjoy a completely stress-free experience from start to delivery.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => { resetAuthStates(); setCreateModalOpen(true); }}
                className={`font-bold px-7 py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 text-base cursor-pointer transform hover:-translate-y-0.5 ${
                  isDarkMode
                    ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-950/60'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                }`}
              >
                <span>🎅 Organize a Gift Exchange</span>
              </button>

              <button
                onClick={() => { resetAuthStates(); setJoinModalOpen(true); }}
                className={`font-bold px-6 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-base cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white shadow-md'
                    : 'bg-emerald-800 text-white border-emerald-900 hover:bg-emerald-900 shadow-md'
                }`}
              >
                <span>🔑 Join an Exchange (Enter Code)</span>
              </button>
            </div>

            <div className={`pt-6 grid grid-cols-3 gap-4 border-t text-xs font-semibold ${
              isDarkMode ? 'border-slate-800 text-slate-400' : 'border-stone-200 text-slate-600'
            }`}>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-sky-400' : 'text-red-700'}`}>⚡ 60-Second Setup</span>
                <span>No complicated setup</span>
              </div>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-emerald-900'}`}>🎁 Easy Wishlists</span>
                <span>Add items from any site</span>
              </div>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-sky-400' : 'text-red-700'}`}>🚚 Shipping Updates</span>
                <span>Real-time tracking</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className={`rounded-3xl p-6 sm:p-8 border shadow-2xl transition-all relative overflow-hidden ${
              isDarkMode
                ? 'bg-slate-900/90 border-slate-800 shadow-slate-950/80'
                : 'bg-white border-stone-200/80 shadow-stone-300/40'
            }`}>
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-slate-800">
                <div className={`flex items-center gap-2 text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full inline-block animate-pulse ${isDarkMode ? 'bg-sky-400' : 'bg-red-600'}`}></span>
                  <span>LIVE EXCHANGE PREVIEW</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                  isDarkMode
                    ? 'bg-slate-950 text-sky-300 border-sky-500/30'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                }`}>
                  Code: SIMPSON-2026
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                }`}>
                  <div className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                    ANNUAL HOLIDAY EXCHANGE
                  </div>
                  <div className={`text-xl font-black mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Simpson Family Secret Santa
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>Budget: <strong className={isDarkMode ? 'text-sky-400 font-bold' : 'text-red-600 font-bold'}>$25 – $50</strong></span>
                    <span>Exchange: <strong className="text-slate-800 dark:text-slate-200 font-bold">Dec 25, 2026</strong></span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-emerald-50/60 border-emerald-200'
                }`}>
                  <div className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-emerald-900'}`}>
                    YOUR ASSIGNED SECRET TARGET
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className={`text-lg font-bold block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Sarah Simpson</span>
                      <span className="text-xs text-slate-500">Wishlist: 3 Items Attached</span>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm ${
                      isDarkMode ? 'bg-sky-500 text-slate-950' : 'bg-red-600 text-white'
                    }`}>
                      View Wishlist →
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Modal: ORGANIZE A GIFT EXCHANGE */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-2xl border transition-all max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-stone-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>🎅 Create Your Gift Exchange</span>
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-100 border border-red-300 text-red-700 text-xs font-bold">
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateExchange} className="space-y-4 text-xs font-semibold">
              <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 space-y-3">
                <span className={`text-xs font-bold block uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
                  Step 1: Security & Account Authentication
                </span>
                
                <div>
                  <label className="block text-slate-500 mb-1">Your Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. joshua@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      checkUserEmail(e.target.value);
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>

                {/* Existing User Recognition */}
                {userIsExisting === true && (
                  <div className="p-3 rounded-xl bg-sky-50 dark:bg-slate-900 border border-sky-200 dark:border-sky-800">
                    <span className="text-xs font-bold text-sky-800 dark:text-sky-300 block mb-1">
                      👋 Welcome back, {existingUserName}!
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                      Enter your password to authenticate and launch the exchange.
                    </p>
                    <label className="block text-slate-500 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isDarkMode ? 'bg-slate-950 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                  </div>
                )}

                {/* New User Registration Fields */}
                {userIsExisting === false && (
                  <>
                    <div>
                      <label className="block text-slate-500 mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Joshua Simpson"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Secret Codename / Handle (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. KovertKlaus-1"
                        value={codename}
                        onChange={(e) => setCodename(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Create Password (Min 10 Characters) *</label>
                      <input
                        type="password"
                        required
                        minLength={10}
                        placeholder="At least 10 chars (A-Z, a-z, 0-9, special char)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                        }`}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Must contain uppercase, lowercase, number, and special character.
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 space-y-3">
                <span className={`text-xs font-bold block uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                  Step 2: Exchange Settings
                </span>
                <div>
                  <label className="block text-slate-500 mb-1">Exchange Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Simpson Family Secret Santa 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">Min Budget ($)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(Number(e.target.value))}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Max Budget ($) *</label>
                    <input
                      type="number"
                      required
                      min={5}
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(Number(e.target.value))}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Exchange Date *</label>
                  <input
                    type="date"
                    required
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${
                    isDarkMode ? 'bg-sky-500 hover:bg-sky-400 text-slate-950' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {loading ? 'Processing...' : '🚀 Launch Exchange'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: JOIN AN EXCHANGE */}
      {joinModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl border transition-all max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-stone-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>🔑 Join a Gift Exchange</span>
              </h3>
              <button onClick={() => setJoinModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-100 border border-red-300 text-red-700 text-xs font-bold">
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleJoinExchange} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Exchange Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KOVERT-8492"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className={`w-full border rounded-2xl px-4 py-3 text-lg font-mono text-center tracking-widest uppercase focus:outline-none focus:ring-2 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-sky-400 focus:ring-sky-400' : 'bg-stone-50 border-stone-300 text-red-700 focus:ring-red-600'
                  }`}
                  maxLength={16}
                />
              </div>

              <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 space-y-3">
                <span className={`text-xs font-bold block uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                  Your Account Authentication
                </span>
                
                <div>
                  <label className="block text-slate-500 mb-1">Your Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. alex@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      checkUserEmail(e.target.value);
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>

                {/* Returning User Recognition */}
                {userIsExisting === true && (
                  <div className="p-3 rounded-xl bg-sky-50 dark:bg-slate-900 border border-sky-200 dark:border-sky-800">
                    <span className="text-xs font-bold text-sky-800 dark:text-sky-300 block mb-1">
                      👋 Welcome back, {existingUserName}!
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                      Enter your password to sign in and join the exchange.
                    </p>
                    <label className="block text-slate-500 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isDarkMode ? 'bg-slate-950 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                  </div>
                )}

                {/* New User Registration Fields */}
                {userIsExisting === false && (
                  <>
                    <div>
                      <label className="block text-slate-500 mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Alex Simpson"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Secret Codename / Handle (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Agent-Alex"
                        value={codename}
                        onChange={(e) => setCodename(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Create Password (Min 10 Characters) *</label>
                      <input
                        type="password"
                        required
                        minLength={10}
                        placeholder="At least 10 chars (A-Z, a-z, 0-9, special char)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                        }`}
                      />
                    </div>
                  </>
                )}

              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${
                    isDarkMode ? 'bg-sky-500 hover:bg-sky-400 text-slate-950' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {loading ? 'Processing...' : '🔑 Join Exchange'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`border-t py-8 text-xs font-medium transition-colors ${
        isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-white border-stone-200 text-slate-500 shadow-inner'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            © 2026 KovertKlaus by <span className="font-semibold text-slate-700 dark:text-slate-300">Joshua Simpson</span>. Made for families & friends.
          </div>
          <div className="flex gap-6 font-semibold">
            <Link href="/features" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>Features & Specs</Link>
            <Link href="/tests" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>Test Bench</Link>
            <a href="https://github.com/MrJSimpson/KovertKlaus" target="_blank" rel="noreferrer" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
