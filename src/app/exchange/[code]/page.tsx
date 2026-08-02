'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCodename } from '@/lib/security';

interface OperationAgent {
  id: string;
  userId: string;
  role: string;
  shippingStatus: string;
  trackingNumber?: string;
  targetUserId?: string;
  user?: {
    name: string;
    codename?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  targetUser?: {
    name: string;
    codename?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

interface OperationData {
  id: string;
  title: string;
  code: string;
  description?: string;
  budgetMin?: number;
  budgetMax: number;
  currency: string;
  inviteCutoffDate: string;
  assignmentDate: string;
  shippingDate?: string;
  executionDate: string;
  status: string;
  isWhiteElephant: boolean;
  opsLeaderId: string;
  opsLeader: {
    id: string;
    name: string;
    codename?: string;
  };
  agents: OperationAgent[];
}

export default function OperationCommandCenterPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.toUpperCase() || '';

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<OperationData | null>(null);

  // Current User Session
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // OpsLeader Control Panel State
  const [drawingTargets, setDrawingTargets] = useState(false);
  const [drawSuccessMessage, setDrawSuccessMessage] = useState('');

  // OpKit & OpTools Scraper State
  const [opToolUrl, setOpToolUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [userOpKit, setUserOpKit] = useState<Array<{ id: string; title: string; price?: number; url: string; thumbnail?: string }>>([]);
  const [validationError, setValidationError] = useState('');

  // Anonymous Intel Messaging State
  const [intelMessageText, setIntelMessageText] = useState('');
  const [sendingIntel, setSendingIntel] = useState(false);
  const [intelLogs, setIntelLogs] = useState<Array<{ id: string; sender: string; text: string; time: string }>>([
    { id: '1', sender: 'Agent-KovertKlaus', text: 'Operation initialized. All agents stand by for target assignment.', time: '10:00 AM' },
  ]);

  useEffect(() => {
    const savedUserId = localStorage.getItem('kovertklaus_user_id');
    const savedUserName = localStorage.getItem('kovertklaus_user_name');
    if (savedUserId) setUserId(savedUserId);
    if (savedUserName) setUserName(savedUserName);

    fetchExchangeDetails();
  }, [code]);

  async function fetchExchangeDetails() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/invitations?code=${code}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Operation not found');
      } else {
        setOperation(json.data);
      }
    } catch {
      setError('Failed to load operation details');
    } finally {
      setLoading(false);
    }
  }

  // Handle Target Draw (OpsLeader Only)
  async function handleTriggerDraw() {
    if (!operation || !userId) return;
    if (!confirm('Are you sure you want to trigger Secret Santa target assignments now using Sattolo\'s derangement algorithm?')) return;

    setDrawingTargets(true);
    setDrawSuccessMessage('');
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draw', operationId: operation.id, userId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to execute target draw');
      }
      setDrawSuccessMessage('🎯 Target assignments successfully executed! All agents have been secretly assigned.');
      fetchExchangeDetails();
    } catch (err: any) {
      alert(err.message || 'Target draw failed');
    } finally {
      setDrawingTargets(false);
    }
  }

  // Handle URL Scraper for OpTools
  async function handleScrapeUrl(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');
    if (!opToolUrl.trim()) return;

    // Strict White Elephant 1-Gift Limit Check
    if (operation?.isWhiteElephant && userOpKit.length >= 1) {
      setValidationError('🐘 White Elephant OpKits are strictly limited to 1 brought gift item per operative!');
      return;
    }

    setScraping(true);
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: opToolUrl.trim() }),
      });
      const json = await res.json();

      const newItem = {
        id: Math.random().toString(36).substring(2, 9),
        title: json.success && json.metadata?.title ? json.metadata.title : opToolUrl.trim(),
        price: json.metadata?.price,
        thumbnail: json.metadata?.thumbnail,
        url: opToolUrl.trim(),
      };
      setUserOpKit((prev) => [...prev, newItem]);
      setOpToolUrl('');
    } catch {
      setUserOpKit((prev) => [
        ...prev,
        { id: Math.random().toString(36).substring(2, 9), title: opToolUrl.trim(), url: opToolUrl.trim() },
      ]);
      setOpToolUrl('');
    } finally {
      setScraping(false);
    }
  }

  // Handle Intel Message Dispatch
  function handleSendIntel(e: React.FormEvent) {
    e.preventDefault();
    if (!intelMessageText.trim()) return;

    setSendingIntel(true);
    const newMsg = {
      id: Math.random().toString(36).substring(2, 9),
      sender: userName ? formatCodename(undefined, userName) : 'Agent-Secret',
      text: intelMessageText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setIntelLogs((prev) => [...prev, newMsg]);
    setIntelMessageText('');
    setSendingIntel(false);
  }

  // Determine User Role & Target in this Operation
  const currentAgent = operation?.agents.find((a) => a.userId === userId);
  const isOpsLeader = operation?.opsLeaderId === userId || currentAgent?.role === 'OPS_LEADER';
  const assignedTarget = currentAgent?.targetUser;

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${
      isDarkMode
        ? 'bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950'
        : 'bg-stone-50 text-slate-900 selection:bg-red-600 selection:text-white'
    }`}>
      
      {/* Top Header Navigation */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${
        isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-stone-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link href="/operations" className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md ${
              isDarkMode ? 'bg-gradient-to-br from-sky-400 to-slate-700' : 'bg-gradient-to-br from-red-600 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                Operation Command Center
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-sky-300' : 'bg-stone-100 border-stone-300 text-slate-700'
              }`}
            >
              {isDarkMode ? '🎄 Light' : '❄️ Dark (Icy)'}
            </button>

            <Link
              href="/operations"
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${
                isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              ← Operations Center
            </Link>
          </div>
        </div>
      </header>

      {/* Main Command Center Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl animate-bounce mb-3">🎁</div>
            <p className="text-sm font-semibold">Initializing Command Center Data Stream...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-bold mb-2">Operation Access Denied</h2>
            <p className="text-xs text-slate-500 mb-6">{error}</p>
            <Link href="/operations" className="px-6 py-3 bg-red-600 text-white font-bold text-xs rounded-xl">
              Return to Operations Center
            </Link>
          </div>
        ) : operation ? (
          <div className="space-y-8">
            
            {/* Primary Operation Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
            }`}>
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold ${
                    isDarkMode ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    CODE: {operation.code}
                  </span>

                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                    operation.isWhiteElephant ? 'bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-300' : 'bg-emerald-100 text-emerald-900 dark:bg-sky-500/20 dark:text-sky-300'
                  }`}>
                    {operation.isWhiteElephant ? '🐘 White Elephant' : '🎁 Secret Santa'}
                  </span>

                  <span className="text-xs text-slate-500">
                    OpsLeader: <strong>{operation.opsLeader.name} ({formatCodename(operation.opsLeader.codename, operation.opsLeader.name)})</strong>
                  </span>
                </div>

                <h1 className="text-3xl font-black">{operation.title}</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Budget Limit: <strong className={isDarkMode ? 'text-sky-400 font-bold' : 'text-red-600 font-bold'}>${operation.budgetMin || 0} – ${operation.budgetMax} {operation.currency}</strong> | Exchange Execution: <strong>{new Date(operation.executionDate).toLocaleDateString()}</strong>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(operation.code);
                    alert(`Copied Invite Code to clipboard: ${operation.code}`);
                  }}
                  className={`px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                    isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <span>📋 Copy Invite Code ({operation.code})</span>
                </button>
              </div>
            </div>

            {/* OpsLeader Administrative Control Console */}
            {isOpsLeader && (
              <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 block">
                      🎖️ OpsLeader Administrative Console
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      As the designated OpsLeader, you control enrollment deadlines, target draws, and compliance logs.
                    </p>
                  </div>

                  <span className="text-xs font-mono font-bold px-3 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 rounded-full">
                    OpsLeader Clearance
                  </span>
                </div>

                {drawSuccessMessage && (
                  <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold">
                    ✓ {drawSuccessMessage}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  {!operation.isWhiteElephant && operation.status === 'RECRUITING' && (
                    <button
                      onClick={handleTriggerDraw}
                      disabled={drawingTargets}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
                    >
                      {drawingTargets ? 'Executing Draw...' : '🎯 Trigger Target Assignment Draw'}
                    </button>
                  )}

                  <button
                    onClick={() => alert(`Operation Code: ${operation.code}\nAgents Enrolled: ${operation.agents.length}`)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs bg-stone-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-stone-300 cursor-pointer"
                  >
                    📊 View Enrollment Stats
                  </button>
                </div>
              </div>
            )}

            {/* 2-Column Command Center Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Target Assignment & OpKit Workspace */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Secret Santa Target Assignment Card */}
                {!operation.isWhiteElephant && (
                  <div className={`p-6 rounded-3xl border shadow-md ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        🎯 Your Secret Assignment
                      </h2>
                      <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold ${
                        assignedTarget
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                      }`}>
                        {assignedTarget ? 'TARGET ASSIGNED' : 'AWAITING DRAW'}
                      </span>
                    </div>

                    {assignedTarget ? (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs text-slate-500 block">Assigned Target Operative:</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">
                              {formatCodename(assignedTarget.codename, assignedTarget.name)}
                            </span>
                          </div>
                          <span className="text-2xl">🎁</span>
                        </div>

                        {assignedTarget.streetAddress && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 border-t border-emerald-200 dark:border-slate-800 pt-2">
                            <span>Courier Address: </span>
                            <strong>{assignedTarget.streetAddress}, {assignedTarget.city}, {assignedTarget.state} {assignedTarget.zipCode}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-2xl">
                        <p className="text-xs text-slate-500">
                          Target assignments have not been drawn yet. Stand by for your OpsLeader to initiate the draw!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* OpKit & OpTools Scraper Section */}
                <div className={`p-6 rounded-3xl border shadow-md ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}>
                  <h2 className="text-xl font-bold mb-0.5 flex items-center gap-2">
                    {operation.isWhiteElephant ? '🐘 White Elephant Brought Gift OpKit' : '🎁 My OpKit'}
                  </h2>
                  <p className="text-xs font-semibold text-red-600 dark:text-sky-400 mb-1">
                    (OpKit = {operation.isWhiteElephant ? 'Single Brought Gift' : 'Your Secret Santa Wishlist'} | OpTools = Wished-for Gift Items)
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    {operation.isWhiteElephant
                      ? 'Add the 1 gift item you are bringing to the live White Elephant pool (Max 1 OpTool).'
                      : 'Paste store product links to populate your Secret Santa OpKit. We\'ll auto-scrape titles and prices!'}
                  </p>

                  {validationError && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                      ⚠️ {validationError}
                    </div>
                  )}

                  <form onSubmit={handleScrapeUrl} className="flex gap-2 mb-6">
                    <input
                      type="url"
                      placeholder="Paste OpTool link (Amazon, Target, Etsy, etc.)"
                      value={opToolUrl}
                      onChange={(e) => setOpToolUrl(e.target.value)}
                      required
                      disabled={operation.isWhiteElephant && userOpKit.length >= 1}
                      className={`flex-1 border rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-2 ${
                        isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-slate-100 focus:ring-sky-400'
                          : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={scraping || (operation.isWhiteElephant && userOpKit.length >= 1)}
                      className={`px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                        operation.isWhiteElephant && userOpKit.length >= 1
                          ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
                          : isDarkMode
                          ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {scraping ? 'Scraping...' : '+ Add OpTool'}
                    </button>
                  </form>

                  {/* OpTools List */}
                  {userOpKit.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-500">Your OpKit is empty. Add an OpTool link above!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userOpKit.map((item) => (
                        <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="h-10 w-10 object-cover rounded-xl border" />
                            ) : (
                              <div className="h-10 w-10 rounded-xl bg-stone-200 dark:bg-slate-800 flex items-center justify-center text-lg">🛍️</div>
                            )}
                            <div>
                              <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold hover:underline block max-w-xs truncate">
                                {item.title}
                              </a>
                              {item.price && <span className="text-xs font-mono text-emerald-600 dark:text-sky-400 font-bold">${item.price}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => { setValidationError(''); setUserOpKit((prev) => prev.filter((i) => i.id !== item.id)); }}
                            className="text-xs text-red-500 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                {/* Anonymous Intel Chat / Log Stream */}
                <div className={`p-6 rounded-3xl border shadow-md ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      💬 Anonymous Intel Messaging Stream
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">Encrypted Channel</span>
                  </div>

                  <div className={`p-4 rounded-2xl border max-h-48 overflow-y-auto space-y-3 mb-4 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                  }`}>
                    {intelLogs.map((log) => (
                      <div key={log.id} className="text-xs">
                        <div className="flex items-center justify-between">
                          <strong className={isDarkMode ? 'text-sky-400' : 'text-red-600'}>{log.sender}</strong>
                          <span className="text-[10px] text-slate-500">{log.time}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{log.text}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendIntel} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Dispatch anonymous intel message..."
                      value={intelMessageText}
                      onChange={(e) => setIntelMessageText(e.target.value)}
                      required
                      className={`flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:ring-sky-400' : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={sendingIntel}
                      className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${
                        isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      Send Intel
                    </button>
                  </form>
                </div>

              </div>

              {/* Right Column: Participant Roster & Shipping Status */}
              <div className="lg:col-span-5 space-y-6">
                <div className={`p-6 rounded-3xl border shadow-md ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      👥 Enrolled Agents ({operation.agents?.length || 0})
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">Status: {operation.status}</span>
                  </div>

                  <div className="space-y-2">
                    {operation.agents?.map((agent, i) => (
                      <div key={agent.id} className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                        isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                      }`}>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-slate-400 text-xs">#{i + 1}</span>
                          <div>
                            <span className="font-bold block">
                              {formatCodename(agent.user?.codename, agent.user?.name)}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase inline-block mt-0.5 ${
                              agent.role === 'OPS_LEADER'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-900 dark:bg-sky-500/20 dark:text-sky-300'
                            }`}>
                              {agent.role === 'OPS_LEADER' ? 'OpsLeader' : 'Agent'}
                            </span>
                          </div>
                        </div>

                        <span className="text-slate-400 font-mono text-[11px] font-bold">
                          {agent.shippingStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

          </div>
        ) : null}

      </main>

    </div>
  );
}
