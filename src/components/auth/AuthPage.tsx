'use client';

/**
 * @file AuthPage.tsx
 * @description Sign in and Create account (design canvas "Sign in" and "Create account", desktop + phone).
 *
 * Tier 1 (what): A brand panel (or, from an invitation link, a mission briefing) beside a form card
 * with "Sign in" / "Create account" folder tabs. Sign in: email, password, forgot link, join by code.
 * Create account: name, email, password with show toggle and live checklist, Terms/Privacy consent.
 * In ALPHA: the activation code field and the clearance request.
 * Tier 2 (why): Sign in gets its own page in the visual refresh (owner decision 2026-11-18),
 * replacing the landing's modal. Invitation and approval emails link to
 * `/register?code=…&email=…[&invite=…]`; those keep working: the code is sent as `inviteCode`, the
 * token as `inviteToken`, exactly as before.
 * Tier 3 (how): Same API calls as the old landing (`POST /api/users/login`, `POST /api/users`,
 * `POST /api/clearance`). A signed-in visitor is sent on at once: to the invited mission, or to
 * `afterAuthPath(next)`. The briefing uses the public preview (`GET /api/operations?code=`), which
 * shows outsiders only title, dates, budget, agent count and the Head Elf's codename.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { USER_ID_KEY } from '@/lib/constants/auth';
import { isAlphaStage } from '@/lib/platform-limits';
import { formatCodename } from '@/lib/security';
import { afterAuthPath, readAuthParams, type AuthParams } from '@/lib/auth-flow';
import { PASSWORD_MIN_LENGTH } from '@/lib/password-policy';
import { PasswordChecklist } from '@/components/PasswordChecklist';
import { Icon } from '@/components/brand/Icon';
import { JoinCodeButton } from '@/components/brand/JoinCodeDialog';
import { PublicShell } from '@/components/brand/PublicShell';
import { brandMarkSvg } from '@/lib/brand-mark';

export type AuthMode = 'login' | 'register';

/** What the public preview tells an invited visitor about the mission. */
interface Briefing {
  code: string;
  title: string;
  type: string;
  headElf: string | null;
  budget: string;
  rsvpBy: string;
  shipBy: string | null;
  agents: string;
}

const EMPTY_PARAMS: AuthParams = { code: null, email: null, invite: null, next: null };

function shortDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase();
}

function money(value: unknown, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n}`;
  }
}

/** Builds the briefing from `GET /api/operations?code=` data; `null` if the response is unusable. */
function toBriefing(d: Record<string, unknown>): Briefing | null {
  if (!d || typeof d.title !== 'string' || typeof d.code !== 'string') return null;
  const currency = typeof d.currency === 'string' ? d.currency : 'USD';
  const members = Array.isArray(d.members) ? (d.members as { codename?: string | null }[]) : [];
  const max = typeof d.maxParticipants === 'number' ? d.maxParticipants : null;
  const count = typeof d.memberCount === 'number' ? d.memberCount : members.length;
  return {
    code: d.code,
    title: d.title,
    type: d.isWhiteElephant ? 'White Elephant' : 'Secret Santa',
    headElf: members[0]?.codename ? formatCodename(members[0].codename).replace(/^Agent:\s*/, '') : null,
    budget: `${money(d.budgetMin, currency)}–${money(d.budgetMax, currency)}`,
    rsvpBy: shortDate(d.inviteCutoffDate) ?? '',
    shipBy: shortDate(d.shippingDate) ?? shortDate(d.executionDate),
    agents: max ? `${count} / ${max}` : `${count}`,
  };
}

const CHECK_ITEMS = ['Names stay hidden until the reveal', 'One invite link for the whole mission', 'Every package tracked to the door'];

/** The brand panel beside the form: the mark, a line, and three promises. */
function BrandPanel() {
  return (
    <div className="flex flex-col justify-center gap-5 p-6 md:p-12 bg-kk-header text-kk-on-header rounded-[var(--kk-radius-lg)]">
      <span
        className="block w-14 h-14 md:w-24 md:h-24 text-kk-on-header"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: brandMarkSvg('kk-auth-mark', 'width="100%" height="100%"') }}
      />
      <h2 className="m-0 font-display font-bold text-[28px] leading-[34px] md:text-[40px] md:leading-[44px] text-kk-on-header text-balance">Every gift is a covert operation.</h2>
      <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
        {CHECK_ITEMS.map((t) => (
          <li key={t} className="flex gap-2.5 items-center">
            <Icon name="check" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The mission briefing shown to visitors arriving from an invitation link. */
function BriefingPanel({ b }: { b: Briefing }) {
  return (
    <div className="flex flex-col gap-5 p-6 md:p-10 bg-kk-header text-kk-on-header rounded-[var(--kk-radius-lg)]">
      <div className="flex justify-between items-center gap-3">
        <p className="eyebrow m-0 uppercase text-kk-on-header">Classified briefing</p>
        <span className="kk-stamp text-kk-on-header">Recruited</span>
      </div>
      <h2 className="m-0 font-display font-bold text-[28px] leading-[34px] text-kk-on-header text-balance">You&apos;ve been recruited to a Holiday Mission.</h2>
      <article className="kk-card kk-file" style={{ marginTop: 30 }}>
        <div className="kk-file__tab">
          <span><span className="max-sm:hidden">Mission file · </span>{b.code}</span>
          {b.rsvpBy && <span className="text-kk-on-header">RSVP by {b.rsvpBy}</span>}
        </div>
        <div className="kk-file__body">
          <div>
            <p className="kk-file__eyebrow">Holiday Mission · {b.type}</p>
            <h3 className="kk-file__title">{b.title}</h3>
          </div>
          {b.headElf && (
            <p className="m-0 flex flex-wrap items-center gap-2">
              Head Elf{' '}
              <span className="kk-codename">
                <span className="kk-codename__label">AGENT</span>
                {b.headElf}
              </span>
            </p>
          )}
          <dl className="kk-meta">
            <div>
              <dt>Budget</dt>
              <dd>{b.budget}</dd>
            </div>
            <div>
              <dt>Ship by</dt>
              <dd>{b.shipBy ?? '—'}</dd>
            </div>
            <div>
              <dt>Agents</dt>
              <dd>{b.agents}</dd>
            </div>
          </dl>
        </div>
      </article>
      <p className="m-0 text-sm leading-[22px] text-kk-on-header">
        Create your account to accept. You get a codename for this mission. Only the Head Elf sees your real name.
      </p>
    </div>
  );
}

/** "Sign in" / "Create account" folder tabs above the form card; keeps the invitation query. */
function AuthTabs({ mode, query }: { mode: AuthMode; query: string }) {
  const tab = (href: string, label: string, current: boolean) => (
    <Link href={`${href}${query}`} aria-current={current ? 'page' : undefined} className={`kk-auth-tab${current ? ' is-current' : ''}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Account" className="flex items-end gap-1 pl-4">
      {tab('/signin', 'Sign in', mode === 'login')}
      {tab('/register', 'Create account', mode === 'register')}
    </nav>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="kk-banner kk-banner--danger">
      <Icon name="alert" size={20} />
      <span>{message}</span>
    </div>
  );
}

/** Alpha only: ask for early access when you have no code. */
function ClearanceRequest() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/clearance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Couldn’t send the request. Try again.');
      setDone(true);
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Couldn’t send the request. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kk-card flex flex-col gap-3" aria-labelledby="clearance-h">
      <h2 id="clearance-h" className="m-0 font-display text-lg font-semibold text-kk-heading">
        No activation code yet?
      </h2>
      <p className="m-0 text-kk-muted">Sign-up is invite-only during the alpha. Ask for early access and we&apos;ll email you a code.</p>
      {done ? (
        <div role="status" className="kk-banner kk-banner--success">
          <Icon name="check" size={20} />
          <span>
            Request received. We&apos;ll write to <strong>{email}</strong> when you&apos;re cleared.
          </span>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {error && <ErrorBanner message={error} />}
          <div className="kk-field">
            <label className="kk-field__label" htmlFor="cl-name">
              Name (optional)
            </label>
            <input id="cl-name" className="kk-field__input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="kk-field">
            <label className="kk-field__label" htmlFor="cl-email">
              Email address
            </label>
            <input id="cl-email" className="kk-field__input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} className="kk-btn kk-btn--secondary kk-btn--block">
            {busy ? 'Sending…' : 'Request early access'}
          </button>
        </form>
      )}
    </section>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { systemConfig } = useTheme();
  // Alpha-only parts wait for the live config (the static HTML is built with the default, ALPHA).
  const isAlpha = systemConfig.edition !== undefined && isAlphaStage(systemConfig.releaseStage);

  const [params, setParams] = useState<AuthParams>(EMPTY_PARAMS);
  const [query, setQuery] = useState('');
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alphaCode, setAlphaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Mount-only: the query string and the session exist only in the browser (static export).
  useEffect(() => {
    const search = window.location.search;
    const p = readAuthParams(search);
    /* eslint-disable react-hooks/set-state-in-effect */
    setParams(p);
    setQuery(search);
    if (p.email) setEmail(p.email);
    if (p.code) setAlphaCode(p.code);
    /* eslint-enable react-hooks/set-state-in-effect */

    let cancelled = false;
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json?.authenticated) return;
        if (p.code && !p.code.startsWith('ALPHA-')) {
          router.replace(`/exchange/${encodeURIComponent(p.code)}${p.invite ? `?invite=${encodeURIComponent(p.invite)}` : ''}`);
        } else {
          router.replace(afterAuthPath(p.next));
        }
      })
      .catch(() => {});

    if (p.code && !p.code.startsWith('ALPHA-')) {
      fetch(`/api/operations?code=${encodeURIComponent(p.code)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!cancelled && json?.success) setBriefing(toBriefing(json.data));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [router]);

  function remember(user: { id: string; name: string }) {
    localStorage.setItem(USER_ID_KEY, user.id);
    localStorage.setItem('kovertklaus_user_name', user.name);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Wrong email or password.');
      remember(json.user);
      router.push(afterAuthPath(params.next));
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Couldn’t sign you in. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          inviteCode: alphaCode.trim() || undefined,
          inviteToken: params.invite || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Couldn’t create the account.');
      remember(json.data);
      router.push(afterAuthPath(params.next));
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Couldn’t create the account. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const invited = mode === 'register' && briefing !== null;
  const heading = mode === 'login' ? 'Welcome back, agent.' : invited ? `Join ${briefing.title}` : 'Become an agent';
  const subheading =
    mode === 'login'
      ? 'Sign in to see your missions and targets.'
      : invited
        ? 'Create your account, then build your Wishlist Manifest.'
        : 'Create an account to run or join Holiday Missions.';

  return (
    <PublicShell bare active={mode === 'login' ? 'signin' : undefined}>
      <main className="mx-auto max-w-[1080px] px-4 md:px-8 pt-6 md:pt-14 pb-10 md:pb-20 flex flex-col md:flex-row md:flex-wrap gap-7 md:gap-10 md:items-start">
        <div className="md:flex-[1_1_420px] md:max-w-[480px] w-full flex flex-col gap-6">
          <div className="flex flex-col">
            <AuthTabs mode={mode} query={query} />
            {mode === 'login' ? (
              <form onSubmit={signIn} className="kk-card flex flex-col gap-[18px] px-6 py-7">
                <div className="flex flex-col gap-1">
                  <h1 className="m-0 font-display font-bold text-kk-heading text-[28px] leading-[34px] text-balance">{heading}</h1>
                  <p className="m-0 text-kk-muted">{subheading}</p>
                </div>
                {error && <ErrorBanner message={error} />}
                <div className="kk-field">
                  <label className="kk-field__label" htmlFor="si-email">
                    Email address
                  </label>
                  <input id="si-email" className="kk-field__input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="kk-field">
                  <div className="flex justify-between items-baseline gap-3">
                    <label className="kk-field__label" htmlFor="si-password">
                      Password
                    </label>
                    <Link href="/reset-password" className="text-[13px] font-semibold">
                      Forgot your password?
                    </Link>
                  </div>
                  <input id="si-password" className="kk-field__input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <button type="submit" disabled={busy} className="kk-btn kk-btn--primary kk-btn--block">
                  <Icon name="key" />
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
                <div className="flex items-center gap-3 text-[13px] text-kk-muted">
                  <span className="flex-1 h-px bg-kk-border" />
                  Have a mission invite?
                  <span className="flex-1 h-px bg-kk-border" />
                </div>
                <JoinCodeButton className="kk-btn kk-btn--ghost kk-btn--block">Join with an invite code</JoinCodeButton>
              </form>
            ) : (
              <form onSubmit={register} className="kk-card flex flex-col gap-[18px] px-6 py-7">
                <div className="flex flex-col gap-1">
                  <h1 className="m-0 font-display font-bold text-kk-heading text-[28px] leading-[34px] text-balance">{heading}</h1>
                  <p className="m-0 text-kk-muted">{subheading}</p>
                </div>
                {error && <ErrorBanner message={error} />}
                {isAlpha && (
                  <div className="kk-field">
                    <label className="kk-field__label" htmlFor="ca-code">
                      Activation code
                    </label>
                    <input
                      id="ca-code"
                      className="kk-field__input font-mono tracking-[0.08em] uppercase"
                      required
                      autoComplete="off"
                      placeholder="ALPHA-XXXXXXXXXXXXXXXX"
                      value={alphaCode}
                      onChange={(e) => setAlphaCode(e.target.value.toUpperCase())}
                      aria-describedby="ca-code-help"
                    />
                    <p id="ca-code-help" className="kk-field__help m-0">
                      From your clearance email or your mission invitation.
                    </p>
                  </div>
                )}
                <div className="kk-field">
                  <label className="kk-field__label" htmlFor="ca-name">
                    Full name
                  </label>
                  <input id="ca-name" className="kk-field__input" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-describedby="ca-name-help" />
                  <p id="ca-name-help" className="kk-field__help m-0">
                    Only the Head Elves of your missions see it. Other agents see your codename.
                  </p>
                </div>
                <div className="kk-field">
                  <label className="kk-field__label" htmlFor="ca-email">
                    Email address
                  </label>
                  <input id="ca-email" className="kk-field__input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="kk-field">
                  <label className="kk-field__label" htmlFor="ca-pw">
                    Password
                  </label>
                  <p className="kk-field__help m-0">Tip: a short sentence is easy to remember and hard to guess.</p>
                  <div className="relative flex">
                    <input
                      id="ca-pw"
                      className="kk-field__input flex-1 min-w-0 pr-[52px]"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby="ca-rules"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-controls="ca-pw"
                      className="absolute right-0 top-0 h-full w-12 grid place-items-center bg-transparent border-0 text-kk-muted cursor-pointer rounded-r-[var(--kk-radius-md)]"
                    >
                      <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                    </button>
                  </div>
                  <PasswordChecklist password={password} id="ca-rules" />
                </div>
                <div className="flex gap-3 items-start">
                  <input type="checkbox" id="ca-terms" required className="w-5 h-5 mt-0.5 shrink-0 accent-kk-primary" />
                  <label htmlFor="ca-terms" className="text-sm leading-[22px]">
                    I agree to the{' '}
                    <Link href="/terms" target="_blank">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" target="_blank">
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>
                <button type="submit" disabled={busy} className="kk-btn kk-btn--primary kk-btn--block">
                  <Icon name="key" />
                  {busy ? 'Creating account…' : invited ? 'Create account and join' : 'Create account'}
                </button>
                <p className="m-0 text-[13px] leading-5 text-kk-muted text-center">
                  Already an agent? <Link href={`/signin${query}`}>Sign in</Link>
                </p>
              </form>
            )}
          </div>
          {isAlpha && mode === 'register' && !params.code && <ClearanceRequest />}
        </div>

        {/* After the form in reading order (phones show it below); beside it on the left from 768px. */}
        <div className="md:order-first md:flex-[1_1_380px] md:pt-12 flex flex-col gap-5">
          {invited ? <BriefingPanel b={briefing} /> : <BrandPanel />}
        </div>
      </main>
    </PublicShell>
  );
}
