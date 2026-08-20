'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateAutomaticOperationDates } from '@/lib/validations/operation';
import { useTheme } from '@/context/ThemeContext';
import { SeasonalLightsStrand } from '@/components/ui/SeasonalLightsStrand';
import { generateRandomCodename } from '@/lib/codenameGenerator';
import { APP_VERSION_LABEL } from '@/lib/version';



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

export function AppHomeLanding() {
  const router = useRouter();
  const { isDarkMode, toggleTheme, theme, bannerText, bannerActive, lightsType } = useTheme();
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Logged-in User State
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; codename?: string } | null>(null);

  // Shared Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [codename, setCodename] = useState('');

  // Exchange Specific Inputs
  const [title, setTitle] = useState('');
  const [budgetMin, setBudgetMin] = useState(0);
  const [budgetMax, setBudgetMax] = useState(50);
  const [executionDate, setExecutionDate] = useState(`${new Date().getFullYear()}-12-25`);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    checkCurrentUser();
  }, []);

  async function checkCurrentUser() {
    try {
      const savedUserId = localStorage.getItem('kovertklaus_user_id');
      const url = savedUserId ? `/api/users/me?userId=${savedUserId}` : '/api/users/me';
      const res = await fetch(url);
      const json = await res.json();
      if (json.authenticated && json.user) {
        setCurrentUser({ id: json.user.id, name: json.user.name, codename: json.user.codename });
        localStorage.setItem('kovertklaus_user_id', json.user.id);
        localStorage.setItem('kovertklaus_user_name', json.user.name);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/users/me', { method: 'DELETE' });
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem('kovertklaus_user_id');
    localStorage.removeItem('kovertklaus_user_name');
    setCurrentUser(null);
  }

  // Handle Direct Sign In (Tab 1)
  async function handleDirectLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Invalid email or password');
      }

      localStorage.setItem('kovertklaus_user_id', json.user.id);
      localStorage.setItem('kovertklaus_user_name', json.user.name);
      setCurrentUser({ id: json.user.id, name: json.user.name, codename: json.user.codename });
      setLoginModalOpen(false);
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  // Handle Direct Registration (Tab 2)
  async function handleDirectRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const cleanCodename = codename.trim()
        ? codename.trim().replace(/^(agent[-:\s]+)/i, '')
        : undefined;

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          codename: cleanCodename,
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Registration failed');
      }

      const user = json.data;
      localStorage.setItem('kovertklaus_user_id', user.id);
      localStorage.setItem('kovertklaus_user_name', user.name);
      setCurrentUser({ id: user.id, name: user.name, codename: user.codename });
      setLoginModalOpen(false);
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  // Handle Organize Exchange Submission
  async function handleCreateExchange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      let userId: string;

      if (currentUser) {
        userId = currentUser.id;
      } else {
        if (name && password) {
          const regRes = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              email: email.trim(),
              codename: codename.trim() ? codename.trim().replace(/^(agent[-:\s]+)/i, '') : undefined,
              password,
            }),
          });
          const regData = await regRes.json();
          if (!regRes.ok || !regData.success) {
            throw new Error(regData.error || 'Registration failed');
          }
          userId = regData.data.id;
        } else {
          const loginRes = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password }),
          });
          const loginData = await loginRes.json();
          if (!loginRes.ok || !loginData.success) {
            throw new Error(loginData.error || 'Invalid credentials');
          }
          userId = loginData.user.id;
        }
      }

      const calculatedDates = calculateAutomaticOperationDates(executionDate);

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
            maxParticipants: 5,
            inviteCutoffDate: calculatedDates.inviteCutoffDate,
            assignmentDate: calculatedDates.assignmentDate,
            shippingDate: calculatedDates.shippingDate,
            executionDate: calculatedDates.executionDate,
          },
        }),
      });

      const opData = await opRes.json();
      if (!opRes.ok || !opData.success) {
        const detailMsg = opData.details?.join(' ') || opData.error;
        throw new Error(detailMsg || 'Failed to create exchange');
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

      if (currentUser) {
        userId = currentUser.id;
      } else {
        if (name && password) {
          const regRes = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              email: email.trim(),
              codename: codename.trim() ? codename.trim().replace(/^(agent[-:\s]+)/i, '') : undefined,
              password,
            }),
          });
          const regData = await regRes.json();
          if (!regRes.ok || !regData.success) {
            throw new Error(regData.error || 'Registration failed');
          }
          userId = regData.data.id;
        } else {
          const loginRes = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password }),
          });
          const loginData = await loginRes.json();
          if (!loginRes.ok || !loginData.success) {
            throw new Error(loginData.error || 'Invalid credentials');
          }
          userId = loginData.user.id;
        }
      }

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
    setEmail('');
    setPassword('');
    setName('');
    setCodename('');
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col font-sans ${theme.pageBg}`}>
      
      {/* Dynamic Announcement Banner */}
      {bannerActive && (
        <div className={`text-xs py-2 px-4 text-center font-medium transition-colors ${
          isDarkMode
            ? 'bg-slate-900 text-sky-300 border-b border-sky-500/20 shadow-inner'
            : 'bg-red-600 text-white shadow-inner'
        }`}>
          <span>{bannerText}</span>
        </div>
      )}

      {/* Dynamic Seasonal Lights Strand */}
      <SeasonalLightsStrand type={lightsType} isDarkMode={isDarkMode} />


      {/* Main Header */}
      <header className={`border-b transition-colors sticky top-0 z-40 backdrop-blur-md ${theme.headerBg}`}>
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
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight block">
                  KovertKlaus
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isDarkMode ? 'bg-sky-950/80 text-sky-300 border-sky-800' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}>
                  {APP_VERSION_LABEL}
                </span>
              </div>
              <span className={`text-xs block font-bold ${theme.textGoldOnDark}`}>
                {isDarkMode ? 'Stealth Winter Exchange' : 'Simple & Fun Gift Exchanges'}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <a href="#how-it-works" className={`transition-colors ${theme.headerNav}`}>
              How It Works
            </a>
            <a href="#benefits" className={`transition-colors ${theme.headerNav}`}>
              Why KovertKlaus
            </a>
            <Link href="/features" className={`transition-colors ${theme.headerNav}`}>
              Features & Specs
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              title="Toggle Theme Mode"
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${theme.btnToggle}`}
            >
              <span>{isDarkMode ? '🎅 Klaus Mode' : '🕶️ Kovert Mode'}</span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className={`font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 ${theme.badgeCode}`}
                >
                  <span>👤 Dashboard</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className={`font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${theme.btnSecondary}`}
                >
                  🚪 Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { resetAuthStates(); setAuthMode('login'); setLoginModalOpen(true); }}
                className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm transform hover:-translate-y-0.5 ${theme.btnPrimary}`}
              >
                🔑 Login / Sign Up
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Christmas Lights Strand */}
      <ChristmasLightsStrand isDarkMode={isDarkMode} />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-16 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6 text-left relative">
            <div className="flex items-center justify-between">
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${theme.badgeCode}`}>
                <span>{isDarkMode ? '❄️ Winter Night Stealth Mode Active' : '🎅 Secret Santa & Holiday Gift Exchanges Made Effortless'}</span>
              </div>
              <div className="hidden sm:block">
                <CharlieBrownTree isDarkMode={isDarkMode} />
              </div>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
              The Easiest, Funnest Way to Organize <br />
              <span className={theme.heroGradient}>
                Secret Santa & Gift Exchanges
              </span>
            </h1>

            <p className={`text-lg max-w-2xl leading-relaxed ${theme.heroSubtext}`}>
              Bring your family, friends, or co-workers together! Create a gift exchange in 60 seconds, build your custom wishlist, and enjoy a completely stress-free experience from start to delivery.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => { resetAuthStates(); setCreateModalOpen(true); }}
                className={`font-bold px-7 py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 text-base cursor-pointer transform hover:-translate-y-0.5 ${theme.btnPrimary}`}
              >
                <span>🎅 Organize a Gift Exchange</span>
              </button>

              <button
                onClick={() => { resetAuthStates(); setJoinModalOpen(true); }}
                className={`font-bold px-7 py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-base cursor-pointer ${theme.btnSecondary}`}
              >
                <span>🔑 Join an Exchange (Enter Code)</span>
              </button>
            </div>

            <div className={`pt-4 grid grid-cols-3 gap-4 border-t text-xs font-medium ${
              isDarkMode ? 'border-slate-800 text-slate-400' : 'border-stone-200 text-slate-600'
            }`}>
              <div>
                <span className={`block font-bold text-sm ${theme.textAccent}`}>⚡ 60-Second Setup</span>
                <span>No complicated setup</span>
              </div>
              <div>
                <span className={`block font-bold text-sm ${theme.textBrand}`}>🧰 Easy Wishlists</span>
                <span>Add items from any store</span>
              </div>
              <div>
                <span className={`block font-bold text-sm ${theme.textAccent}`}>🚚 Delivery Tracking</span>
                <span>Direct courier updates</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className={`rounded-3xl p-6 sm:p-8 border shadow-2xl transition-all relative overflow-hidden ${theme.cardBg}`}>
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-slate-800">
                <div className={`flex items-center gap-2 text-xs font-bold ${theme.textAccent}`}>
                  <span className={`h-2.5 w-2.5 rounded-full inline-block animate-pulse ${isDarkMode ? 'bg-sky-400' : 'bg-red-600'}`}></span>
                  <span>LIVE EXCHANGE PREVIEW</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${theme.badgeCode}`}>
                  Code: SIMPSON-2026
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className={`p-4 rounded-2xl border ${theme.cardInnerBg}`}>
                  <div className={`text-xs font-bold uppercase tracking-wider ${theme.textBrand}`}>
                    ANNUAL HOLIDAY EXCHANGE
                  </div>
                  <div className="text-xl font-black mt-1">
                    Simpson Family Secret Santa
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>Budget: <strong className={theme.textAccent}>$25 – $50</strong></span>
                    <span>Exchange: <strong className={theme.textDate}>Dec 25, 2026</strong></span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${theme.cardInnerBg}`}>
                  <div className={`text-xs font-bold uppercase tracking-wider ${theme.textBrand}`}>
                    YOUR ASSIGNED SECRET TARGET
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold block">Agent: Sarah</span>
                      <span className="text-xs text-slate-500">Wishlist: 3 Items Added</span>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm ${theme.btnPrimary}`}>
                      View Wishlist →
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* SECTION 1: HOW IT WORKS */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-8 py-16 w-full border-t border-stone-200 dark:border-slate-800">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3 ${theme.badgeCode}`}>
            ✨ Simple 4-Step Process
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            How Remote Secret Santa Works
          </h2>
          <p className={`text-base ${theme.heroSubtext}`}>
            Connect with family, friends, or co-workers near and far. We take care of matching, addresses, and tracking so you can focus on the fun!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className={`p-6 rounded-3xl border flex flex-col justify-between transition-all hover:-translate-y-1 ${theme.cardBg}`}>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 flex items-center justify-center text-2xl font-black text-red-700 dark:text-red-400 mb-4">
                1
              </div>
              <h3 className="text-xl font-bold mb-2">Create Your Exchange</h3>
              <p className={`text-xs leading-relaxed ${theme.textSubLabel}`}>
                Set a gift budget ($25–$50) and exchange date in 60 seconds. Invite your group with a simple code or direct link.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-200 dark:border-slate-800 text-[11px] font-bold text-red-700 dark:text-sky-400">
              ⚡ Takes less than 1 minute
            </div>
          </div>

          {/* Step 2 */}
          <div className={`p-6 rounded-3xl border flex flex-col justify-between transition-all hover:-translate-y-1 ${theme.cardBg}`}>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-2xl font-black text-emerald-800 dark:text-emerald-400 mb-4">
                2
              </div>
              <h3 className="text-xl font-bold mb-2">Build Your Wishlist</h3>
              <p className={`text-xs leading-relaxed ${theme.textSubLabel}`}>
                Add gift ideas from any website or online store! Paste links or search items so your Secret Santa knows what brings you joy.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-200 dark:border-slate-800 text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
              🎁 Works with any web store
            </div>
          </div>

          {/* Step 3 */}
          <div className={`p-6 rounded-3xl border flex flex-col justify-between transition-all hover:-translate-y-1 ${theme.cardBg}`}>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-2xl font-black text-amber-800 dark:text-amber-400 mb-4">
                3
              </div>
              <h3 className="text-xl font-bold mb-2">Get Secret Match</h3>
              <p className={`text-xs leading-relaxed ${theme.textSubLabel}`}>
                Our system randomly assigns everyone a secret target. View their wishlist, preferences, and size details in total secrecy!
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-200 dark:border-slate-800 text-[11px] font-bold text-amber-800 dark:text-amber-400">
              🕵️ 100% Confidential
            </div>
          </div>

          {/* Step 4 */}
          <div className={`p-6 rounded-3xl border flex flex-col justify-between transition-all hover:-translate-y-1 ${theme.cardBg}`}>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-2xl font-black text-sky-700 dark:text-sky-400 mb-4">
                4
              </div>
              <h3 className="text-xl font-bold mb-2">Ship & Celebrate</h3>
              <p className={`text-xs leading-relaxed ${theme.textSubLabel}`}>
                Ship your gift directly to your target&apos;s shipping address before the cutoff date, then meet up or join a call to unwrap!
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-200 dark:border-slate-800 text-[11px] font-bold text-sky-700 dark:text-sky-400">
              📦 Automated Shipping Reminders
            </div>
          </div>
        </div>

        {/* Bonus Exchanges Banner */}
        <div className={`mt-10 p-6 rounded-3xl border text-center flex flex-col sm:flex-row items-center justify-between gap-4 ${theme.cardInnerBg}`}>
          <div className="text-left">
            <h4 className="text-base font-extrabold flex items-center gap-2">
              <span>🎉 Hosting an In-Person Party? We Do That Too!</span>
            </h4>
            <p className={`text-xs mt-1 ${theme.textSubLabel}`}>
              Toggle your exchange settings to <strong>Local-Only</strong> for in-person handoffs, or try <strong>White Elephant</strong> for sneaky gift-stealing party games!
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${theme.badgeSecretSanta}`}>🏠 Local-Only</span>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${theme.badgeWhiteElephant}`}>🐘 White Elephant</span>
          </div>
        </div>
      </section>

      {/* SECTION 2: WHY KOVERTKLAUS */}
      <section id="benefits" className="max-w-7xl mx-auto px-4 sm:px-8 py-16 w-full border-t border-stone-200 dark:border-slate-800">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3 ${theme.badgeCode}`}>
            💡 Stress-Free Holiday Gifting
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            Why You&apos;ll Love KovertKlaus
          </h2>
          <p className={`text-base ${theme.heroSubtext}`}>
            We solved all the classic Secret Santa headaches so your group can enjoy a fun, memorable exchange.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Benefit 1 */}
          <div className={`p-8 rounded-3xl border transition-all hover:shadow-xl ${theme.cardBg}`}>
            <div className="text-4xl mb-4">🛍️</div>
            <h3 className="text-xl font-bold mb-2">Easy Wishlist Creation</h3>
            <p className={`text-xs leading-relaxed ${theme.textSubLabel}`}>
              Never guess what to buy! Simply paste links from Amazon, Target, Etsy, or any online store. Price checking and automatic product details ensure no duplicate buying or awkward returns.
            </p>
          </div>

          {/* Benefit 2 */}
          <div className={`p-8 rounded-3xl border transition-all hover:shadow-xl ${theme.cardBg}`}>
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-bold mb-2">Verified Recipient Details</h3>
            <p className={`text-xs leading-relaxed ${theme.textSubLabel}`}>
              Know your recipient inside out! View their favorite hobbies, fandoms, color preferences, and optional apparel/footwear sizing in total privacy so your gift is guaranteed to impress.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className={`p-8 rounded-3xl border transition-all hover:shadow-xl ${theme.cardBg}`}>
            <div className="text-4xl mb-4">👑</div>
            <h3 className="text-xl font-bold mb-2">Full Host Control</h3>
            <p className={`text-xs leading-relaxed ${theme.textSubLabel}`}>
              Organizers get complete control! Effortlessly manage invites, customize budgets, set automated shipping deadlines, add custom rules, and ensure everyone participates on time.
            </p>
          </div>
        </div>
      </section>

      {/* Modal: DIRECT SIGN IN / SIGN UP (TABBED SYSTEM) */}
      {loginModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full border transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>{authMode === 'login' ? '🔑 Sign In' : '✨ Create Elf Agent Profile'}</span>
              </h3>
              <button
                onClick={() => setLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-stone-200 dark:border-slate-800 mb-5 font-bold text-xs">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setErrorMessage(''); }}
                className={`w-1/2 py-2.5 text-center border-b-2 transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                🔑 Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setErrorMessage(''); }}
                className={`w-1/2 py-2.5 text-center border-b-2 transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                ✨ Sign Up (New Elf Agent)
              </button>
            </div>

            {errorMessage && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {errorMessage}
              </div>
            )}

            {/* TAB 1: SIGN IN */}
            {authMode === 'login' && (
              <form onSubmit={handleDirectLogin} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-500 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. joshua@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(false)}
                    className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
                  >
                    {loading ? 'Signing In...' : '🔑 Sign In'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: CREATE AGENT PROFILE (SIGN UP) */}
            {authMode === 'register' && (
              <form onSubmit={handleDirectRegister} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-500 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Joshua Simpson"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. joshua@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-500">Elf Agent Nickname / Codename</label>
                    <button
                      type="button"
                      onClick={() => setCodename(generateRandomCodename())}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      🎲 Randomize Call Sign
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold px-3 py-2 rounded-xl border ${theme.badgeCode}`}>
                      Agent:
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Viper, Phoenix, Sentinel"
                      value={codename}
                      onChange={(e) => setCodename(e.target.value)}
                      className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Create Strong Password *</label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    placeholder="Enter new strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>

                {password.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-[11px] space-y-1.5 font-mono">
                    <div className="font-bold mb-1 text-slate-700 dark:text-slate-300">Password Security Requirements:</div>
                    <div className={password.length >= 10 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                      {password.length >= 10 ? '✓' : '○'} Minimum 10 characters long
                    </div>
                    <div className={/[A-Z]/.test(password) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                      {/[A-Z]/.test(password) ? '✓' : '○'} At least 1 uppercase letter (A-Z)
                    </div>
                    <div className={/[a-z]/.test(password) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                      {/[a-z]/.test(password) ? '✓' : '○'} At least 1 lowercase letter (a-z)
                    </div>
                    <div className={/[0-9]/.test(password) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                      {/[0-9]/.test(password) ? '✓' : '○'} At least 1 number (0-9)
                    </div>
                    <div className={/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                      {/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password) ? '✓' : '○'} At least 1 special character (!@#$%^&*)
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(false)}
                    className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
                  >
                    {loading ? 'Creating Profile...' : '🚀 Create Agent Profile'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: ORGANIZE A GIFT EXCHANGE */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-lg w-full border transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>🎅 Create Your Gift Exchange</span>
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {errorMessage && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateExchange} className="space-y-4 text-xs font-semibold">
              <div className={`p-4 rounded-2xl border space-y-3 ${theme.cardInnerBg}`}>
                <span className={`text-xs font-bold block uppercase tracking-wider ${theme.textAccent}`}>
                  Step 1: OpsLeader Account Authentication
                </span>
                
                {currentUser ? (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${theme.badgeCode}`}>
                    <div>
                      <span className="text-xs font-bold block">
                        👋 Authenticated as {currentUser.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Operational Leader Clearance Active
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ Active
                    </span>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-slate-500 mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Joshua Simpson"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Your Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. joshua@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-500">Secret Codename / Call Sign</label>
                        <button
                          type="button"
                          onClick={() => setCodename(generateRandomCodename())}
                          className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          🎲 Randomize Call Sign
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-3 py-2 rounded-xl border ${theme.badgeCode}`}>
                          Agent:
                        </span>
                        <input
                          type="text"
                          placeholder="e.g. Viper, Phoenix, Sentinel"
                          value={codename}
                          onChange={(e) => setCodename(e.target.value)}
                          className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Password *</label>
                      <input
                        type="password"
                        required
                        minLength={10}
                        placeholder="Enter your account password (or set new)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className={`p-4 rounded-2xl border space-y-3 ${theme.cardInnerBg}`}>
                <span className={`text-xs font-bold block uppercase tracking-wider ${theme.textBrand}`}>
                  Step 2: Exchange Settings & Automated Timeline
                </span>
                <div>
                  <label className="block text-slate-500 mb-1">Exchange Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Simpson Family Secret Santa 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
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
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
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
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Execution / Event Date *</label>
                  <input
                    type="date"
                    required
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 font-normal">
                    ⚡ <strong>Automated Timeline:</strong> Go/No-Go (25%), Target Assignment (50%), Shipping Deadline (75%) are automatically set.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
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
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full border transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>🔑 Join a Gift Exchange</span>
              </h3>
              <button onClick={() => setJoinModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {errorMessage && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleJoinExchange} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Exchange Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. K9X2-R7M4"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className={`w-full border rounded-2xl px-4 py-3 text-lg font-mono text-center tracking-widest uppercase focus:outline-none ${theme.inputModalBg}`}
                  maxLength={16}
                />
              </div>

              <div className={`p-4 rounded-2xl border space-y-3 ${theme.cardInnerBg}`}>
                <span className={`text-xs font-bold block uppercase tracking-wider ${theme.textBrand}`}>
                  Operative Clearance & Account Authentication
                </span>
                
                {currentUser ? (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${theme.badgeCode}`}>
                    <div>
                      <span className="text-xs font-bold block">
                        👋 Authenticated as {currentUser.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Field Agent Clearance Active
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ Active
                    </span>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-slate-500 mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Alex Simpson"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Your Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. alex@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-500">Secret Codename / Call Sign</label>
                        <button
                          type="button"
                          onClick={() => setCodename(generateRandomCodename())}
                          className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          🎲 Randomize Call Sign
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-3 py-2 rounded-xl border ${theme.badgeCode}`}>
                          Agent:
                        </span>
                        <input
                          type="text"
                          placeholder="e.g. Viper, Phoenix, Sentinel"
                          value={codename}
                          onChange={(e) => setCodename(e.target.value)}
                          className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Password *</label>
                      <input
                        type="password"
                        required
                        minLength={10}
                        placeholder="Enter your account password (or set new)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
                >
                  {loading ? 'Processing...' : '🔑 Join Exchange'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`border-t py-8 text-xs font-medium transition-colors ${theme.footerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="pl-12 sm:pl-0 flex items-center gap-2">
            <span>© 2026 KovertKlaus by <span className="font-semibold text-amber-300/90 dark:text-slate-300">Joshua Simpson</span>.</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              isDarkMode ? 'bg-slate-900 text-sky-400 border-slate-700' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}>
              {APP_VERSION_LABEL}
            </span>
          </div>
          <div className="flex gap-6 font-semibold items-center">
            <Link href="/features" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>Features &amp; Specs</Link>
            <Link href="/tests" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>Test Bench</Link>
            <a href="https://github.com/MrJSimpson/KovertKlaus" target="_blank" rel="noreferrer" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
