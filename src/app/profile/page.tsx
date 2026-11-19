'use client';

/**
 * @file page.tsx (/profile)
 * @description The Profile page: who you are, shipping address, gift dossier, notifications,
 * password, service record and account deletion, on one page.
 *
 * Tier 1 (what): One form for name, address, dossier (with a "Head Elf can see" switch per group)
 * and email notifications, saved together from a save bar that appears with the first change
 * ("N unsaved changes · Discard · Save changes"). The password has its own "Change password".
 * The email address is read-only. Service record shows Coal Citations, status and missions. Delete
 * account opens `/delete-account`. Wide screens get a section list beside the form.
 * Tier 2 (why): Visual refresh (2.0.0-beta, design canvas "Profile" desktop, phone and demo).
 * Replaces the Account Preferences dialog. Owner decisions 2026-11-19: email stays read-only (it is
 * the sign-in identifier); deletion reuses the `/delete-account` page.
 * Tier 3 (how): Loads `GET /api/users/me` (sign-in and email-verification state), then
 * `GET /api/users/profile`. Form state, change counting and the save body live in
 * `src/lib/profile-form.ts`. Leaving with unsaved changes asks first: `beforeunload` for reloads and
 * closing, a click check for links inside the app. `/profile#address` (the Alerts page's "Add my
 * address") scrolls to the address once the form has loaded. A save fires `ALERTS_CHANGED_EVENT`,
 * because a completed address clears the pinned shipping alert.
 */

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppShell, ALERTS_CHANGED_EVENT, useLayoutMode } from '@/components/brand/AppShell';
import { Icon } from '@/components/brand/Icon';
import { EMAIL_UNVERIFIED_CODE, USER_ID_KEY } from '@/lib/constants/auth';
import { fetchJsonWithRetry } from '@/lib/load-retry';
import {
  changedFields,
  COUNTRIES,
  formFromUser,
  passwordChangeProblem,
  profilePayload,
  standingBanner,
  statusLabel,
  trimForm,
  type ProfileForm,
} from '@/lib/profile-form';

const EYEBROW = 'm-0 font-display text-xs leading-4 font-semibold tracking-[0.12em] uppercase text-kk-muted';
const H2 = 'm-0 font-display text-[22px] leading-7 font-semibold text-kk-heading';
const LEAD = 'm-0 text-sm leading-[22px] text-kk-muted';
const CHECKBOX = 'w-5 h-5 mt-0.5 flex-none [accent-color:var(--kk-primary)] cursor-pointer';

const SECTIONS = [
  { id: 'identity', label: 'Who you are' },
  { id: 'address', label: 'Shipping address' },
  { id: 'dossier', label: 'Gift dossier' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Password and security' },
  { id: 'record', label: 'Service record' },
] as const;

/** Read-only facts shown beside the form. */
interface Record_ {
  email: string;
  createdAt: string | null;
  coalCitations: number;
  accountStatus: string;
  missionCount: number | null;
}

type TextKey = { [K in keyof ProfileForm]: ProfileForm[K] extends string ? K : never }[keyof ProfileForm];
type FlagKey = { [K in keyof ProfileForm]: ProfileForm[K] extends boolean ? K : never }[keyof ProfileForm];

function SectionHead({ title, lead }: { title: string; lead: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className={H2}>{title}</h2>
      <p className={LEAD}>{lead}</p>
    </div>
  );
}

const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: '14px 16px' });

export default function ProfilePage() {
  const layout = useLayoutMode();
  const [loading, setLoading] = useState(true);
  const [wakingUp, setWakingUp] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [saved, setSaved] = useState<ProfileForm | null>(null);
  const [draft, setDraft] = useState<ProfileForm | null>(null);
  const [record, setRecord] = useState<Record_ | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedNote, setSavedNote] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [activeSection, setActiveSection] = useState<string>('identity');

  // Who is signed in, then their profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchJsonWithRetry('/api/users/me', { onRetry: () => setWakingUp(true) });
        if (cancelled) return;
        if (me.status === 403 && me.json.code === EMAIL_UNVERIFIED_CODE) {
          window.location.replace('/verify-email');
          return;
        }
        if (!(me.ok && me.json.authenticated && me.json.user)) {
          if (me.status === 401 || me.status === 404) localStorage.removeItem(USER_ID_KEY);
          return;
        }
        setSignedIn(true);
        const res = await fetch('/api/users/profile');
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json.user) throw new Error();
        const form = formFromUser(json.user);
        setSaved(form);
        setDraft(form);
        setRecord({
          email: String(json.user.email ?? ''),
          createdAt: typeof json.user.createdAt === 'string' ? json.user.createdAt : null,
          coalCitations: Number(json.user.penaltyPoints ?? json.user.demerits ?? 0),
          accountStatus: String(json.user.accountStatus ?? 'ACTIVE'),
          missionCount: typeof json.user.missionCount === 'number' ? json.user.missionCount : null,
        });
      } catch {
        if (!cancelled) setLoadError('Your profile could not be loaded. Check your connection and reload the page.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setWakingUp(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const changes = saved && draft ? changedFields(saved, draft) : [];
  const dirty = changes.length > 0;
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // `/profile#address`: the browser looked for the section before it existed, so scroll once loaded.
  const loaded = Boolean(draft);
  useEffect(() => {
    if (!loaded) return;
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [loaded]);

  // Ask before leaving with unsaved changes: reload or close, and links inside the app.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('You have unsaved changes. Leave without saving them?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  // Section list: mark the section nearest the top of the window.
  const wide = layout === 'wide';
  useEffect(() => {
    if (!loaded || !wide) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveSection(top.target.id);
      },
      { rootMargin: '0px 0px -60% 0px' },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loaded, wide]);

  useEffect(() => {
    if (!savedNote) return;
    const t = window.setTimeout(() => setSavedNote(false), 4000);
    return () => window.clearTimeout(t);
  }, [savedNote]);

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSavedNote(false);
    setSaveError('');
  }

  function discard() {
    setDraft(saved);
    setSaveError('');
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setSaveError('Your name cannot be empty.');
      document.getElementById('pf-name')?.focus();
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload(draft)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Your changes could not be saved. Try again.');
      const trimmed = trimForm(draft);
      setSaved(trimmed);
      setDraft(trimmed);
      setSavedNote(true);
      // A completed address clears the pinned shipping alert.
      window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Your changes could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    const problem = passwordChangeProblem(currentPassword, newPassword, confirmPassword);
    if (problem) {
      setPasswordResult({ ok: false, text: problem });
      return;
    }
    setPasswordBusy(true);
    setPasswordResult(null);
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Your password could not be changed. Try again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordResult({ ok: true, text: 'Password changed. Your other devices are signed out.' });
    } catch (err) {
      setPasswordResult({ ok: false, text: err instanceof Error ? err.message : 'Your password could not be changed. Try again.' });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await fetch('/api/users/me', { method: 'DELETE' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem('kovertklaus_user_name');
      // A full load, so no signed-in state survives.
      window.location.replace('/');
    }
  }

  const textField = (key: TextKey, label: string, opts: { id: string; autoComplete?: string; placeholder?: string; help?: string; required?: boolean }) => (
    <div className="kk-field">
      <label className="kk-field__label" htmlFor={opts.id}>
        {label}
      </label>
      <input
        className="kk-field__input"
        id={opts.id}
        type="text"
        value={draft?.[key] ?? ''}
        onChange={(e) => set(key, e.target.value)}
        autoComplete={opts.autoComplete ?? 'off'}
        placeholder={opts.placeholder}
        required={opts.required}
        aria-describedby={opts.help ? `${opts.id}-help` : undefined}
      />
      {opts.help && (
        <span className="kk-field__help" id={`${opts.id}-help`}>
          {opts.help}
        </span>
      )}
    </div>
  );

  const visibilityRow = (key: FlagKey, id: string, label: string) => {
    const on = Boolean(draft?.[key]);
    return (
      <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-2 px-3.5 py-3 bg-kk-inset border border-kk-border rounded-[var(--kk-radius-md)]">
        <label htmlFor={id} className="flex gap-3 items-center min-h-11 cursor-pointer">
          <input id={id} type="checkbox" checked={on} onChange={(e) => set(key, e.target.checked)} className={`${CHECKBOX} !mt-0`} />
          <span>
            <span className="font-semibold">{label}</span>
            <span className="sr-only">: Head Elf can see</span>
          </span>
        </label>
        <span className={`kk-pill ${on ? 'kk-pill--success' : 'kk-pill--neutral'}`} aria-hidden="true">
          {on ? 'Head Elf can see' : 'Only your Secret Santa'}
        </span>
      </div>
    );
  };

  const agentSince = record?.createdAt ? new Date(record.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  const standing = standingBanner(record?.accountStatus ?? 'ACTIVE');
  const passwordOk = passwordResult?.ok;

  return (
    <AppShell active="profile" onSignOut={handleSignOut}>
      <main className="mx-auto w-full max-w-[1120px] px-4 md:px-8 pt-6 md:pt-8 pb-8 md:pb-12 flex flex-col gap-6">
        {loading ? (
          <div role="status" className="py-20 text-center flex flex-col items-center gap-3">
            <span className="kk-stamp">Opening your file</span>
            {wakingUp && <p className="m-0 text-kk-muted">Waking up the North Pole servers. This can take up to half a minute.</p>}
          </div>
        ) : !signedIn ? (
          <div className="kk-card max-w-xl mx-auto mt-10 flex flex-col items-center text-center gap-3">
            <h1 className="m-0 font-display text-[28px] leading-[34px] font-bold text-kk-heading">You&apos;re signed out</h1>
            <p className="m-0 text-kk-muted">Sign in to see your profile.</p>
            <Link href="/signin" className="kk-btn kk-btn--primary">
              <Icon name="key" />
              Sign in
            </Link>
          </div>
        ) : !draft || !record ? (
          <div className="kk-banner kk-banner--danger" role="alert">
            <Icon name="alert" size={20} />
            <span>{loadError || 'Your profile could not be loaded.'}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <p className={EYEBROW}>Your profile</p>
              <h1 className="m-0 font-display font-bold text-kk-heading text-balance text-[28px] leading-[34px] md:text-4xl md:leading-10 break-words">
                {saved?.name || 'Your profile'}
              </h1>
            </div>

            <div className="flex flex-wrap gap-8 items-start">
              {wide && (
                <nav aria-label="Profile sections" className="sticky top-6 flex-[1_1_200px] max-w-[240px]">
                  <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
                    {SECTIONS.map((s) => {
                      const current = activeSection === s.id;
                      return (
                        <li key={s.id}>
                          <a
                            href={`#${s.id}`}
                            onClick={() => setActiveSection(s.id)}
                            aria-current={current ? 'location' : undefined}
                            className={`flex items-center min-h-10 px-3 rounded-[var(--kk-radius-md)] no-underline border ${
                              current ? 'bg-kk-surface text-kk-heading font-bold border-kk-border' : 'text-kk-ink border-transparent hover:bg-kk-surface'
                            }`}
                          >
                            {s.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              )}

              <form
                className="flex-[999_1_560px] min-w-0 flex flex-col gap-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (dirty) save();
                }}
                noValidate
              >
                <section id="identity" className="kk-card kk-file scroll-mt-6">
                  <div className="kk-file__tab">
                    <span>Personnel file</span>
                    {agentSince && <span>Agent since {agentSince}</span>}
                  </div>
                  <div className="kk-file__body">
                    <SectionHead
                      title="Who you are"
                      lead="Your real name is shown only to the Head Elf of each mission you join, so they know who is behind your codename."
                    />
                    <div style={grid(220)}>
                      {textField('name', 'Full name', { id: 'pf-name', autoComplete: 'name', required: true })}
                      <div className="kk-field">
                        <label className="kk-field__label" htmlFor="pf-email">
                          Email address
                        </label>
                        <input className="kk-field__input !bg-kk-inset !text-kk-muted cursor-default" id="pf-email" type="email" value={record.email} readOnly aria-describedby="pf-email-help" />
                        <span className="kk-field__help" id="pf-email-help">
                          You sign in with this address, so it can&apos;t be changed here.
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                <section id="address" className="kk-card flex flex-col gap-4 scroll-mt-6">
                  <SectionHead title="Shipping address" lead="Shared with your Secret Santa (to ship) and your Head Elf. Never with other agents." />
                  {textField('streetAddress', 'Street address', { id: 'pf-street', autoComplete: 'address-line1' })}
                  {textField('addressLine2', 'Apartment, suite or unit', { id: 'pf-line2', autoComplete: 'address-line2', placeholder: 'Optional' })}
                  <div style={grid(180)}>
                    {textField('city', 'City', { id: 'pf-city', autoComplete: 'address-level2' })}
                    {textField('state', 'State or province', { id: 'pf-state', autoComplete: 'address-level1' })}
                    {textField('zipCode', 'ZIP or postal code', { id: 'pf-zip', autoComplete: 'postal-code' })}
                  </div>
                  <div className="kk-field">
                    <label className="kk-field__label" htmlFor="pf-country">
                      Country
                    </label>
                    <select className="kk-field__input" id="pf-country" value={draft.country} onChange={(e) => set('country', e.target.value)} autoComplete="country">
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {textField('deliveryNotes', 'Delivery notes', {
                    id: 'pf-notes',
                    help: 'Gate codes or where to leave packages. Seen by your Secret Santa.',
                  })}
                </section>

                <section id="dossier" className="kk-card flex flex-col gap-4 scroll-mt-6">
                  <SectionHead
                    title="Gift dossier"
                    lead="Helps your Secret Santa choose. They always see what you fill in; choose what your Head Elf may see too."
                  />
                  {/* Agents mistook these hints for their wishlist and the draw stayed paused (beta feedback 2026-11-18). */}
                  <p className="m-0 text-sm text-kk-muted">
                    These are hints, not your wishlist. Each mission still needs at least one gift in your Wishlist Manifest on the mission page.
                  </p>
                  {visibilityRow('showSizes', 'pf-v-sizes', 'Sizes')}
                  <div style={grid(180)}>
                    {textField('topHalfSize', 'Top or shirt', { id: 'pf-top', placeholder: 'e.g. M' })}
                    {textField('bottomHalfSize', 'Bottom or pants', { id: 'pf-bottom', placeholder: 'e.g. 32x30' })}
                    {textField('shoeSize', 'Shoe size', { id: 'pf-shoe', placeholder: 'e.g. 8 W' })}
                  </div>
                  {visibilityRow('showMeasurements', 'pf-v-meas', 'Measurements')}
                  <div style={grid(180)}>
                    {textField('chestBustMeasurement', 'Chest or bust (in)', { id: 'pf-chest' })}
                    {textField('waistMeasurement', 'Waist (in)', { id: 'pf-waist' })}
                    {textField('inseamMeasurement', 'Inseam (in)', { id: 'pf-inseam' })}
                  </div>
                  {visibilityRow('showAllergies', 'pf-v-allergy', 'Allergies and diet')}
                  {textField('allergiesDiet', 'Allergies and diet', { id: 'pf-allergy', placeholder: 'e.g. Peanuts, vegetarian' })}
                  {visibilityRow('showFavorites', 'pf-v-fav', 'Favourites and dislikes')}
                  <div style={grid(220)}>
                    {textField('favoriteColors', 'Favourite colours', { id: 'pf-colors' })}
                    {textField('favoriteHobbies', 'Hobbies', { id: 'pf-hobbies' })}
                  </div>
                  {textField('dislikes', 'Dislikes', { id: 'pf-dislikes', placeholder: 'e.g. Scented candles' })}
                </section>

                <section id="notifications" className="kk-card flex flex-col gap-4 scroll-mt-6">
                  <SectionHead title="Notifications" lead="Emails about your missions. Password resets and security emails always send." />
                  <label htmlFor="pf-email-on" className="flex gap-3 items-start min-h-11 cursor-pointer">
                    <input
                      id="pf-email-on"
                      type="checkbox"
                      checked={draft.emailNotifications}
                      onChange={(e) => set('emailNotifications', e.target.checked)}
                      className={CHECKBOX}
                    />
                    <span>
                      <span className="font-semibold">Email me about my missions</span>
                      <span className="block text-[13px] leading-5 text-kk-muted">Invitations, the draw, shipping deadlines and the party.</span>
                    </span>
                  </label>
                </section>

                <section id="security" className="kk-card flex flex-col gap-4 scroll-mt-6">
                  <SectionHead title="Password and security" lead="Changing your password signs you out on every other device." />
                  <div className="kk-field">
                    <label className="kk-field__label" htmlFor="pf-cur">
                      Current password
                    </label>
                    <input
                      className="kk-field__input"
                      id="pf-cur"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div style={grid(220)}>
                    <div className="kk-field">
                      <label className="kk-field__label" htmlFor="pf-new">
                        New password
                      </label>
                      <input
                        className="kk-field__input"
                        id="pf-new"
                        type="password"
                        autoComplete="new-password"
                        aria-describedby="pf-new-help"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <span className="kk-field__help" id="pf-new-help">
                        At least 10 characters. A short phrase works well.
                      </span>
                    </div>
                    <div className="kk-field">
                      <label className="kk-field__label" htmlFor="pf-new2">
                        Confirm new password
                      </label>
                      <input
                        className="kk-field__input"
                        id="pf-new2"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div aria-live="polite">
                    {passwordResult && (
                      <div className={`kk-banner ${passwordOk ? 'kk-banner--success' : 'kk-banner--danger'}`} role={passwordOk ? 'status' : 'alert'}>
                        <Icon name={passwordOk ? 'check' : 'alert'} size={20} />
                        <span>{passwordResult.text}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={changePassword}
                      disabled={passwordBusy || !(currentPassword || newPassword || confirmPassword)}
                      className="kk-btn kk-btn--secondary"
                    >
                      <Icon name="lock" />
                      {passwordBusy ? 'Changing…' : 'Change password'}
                    </button>
                  </div>
                </section>

                <section id="record" className="kk-card flex flex-col gap-4 scroll-mt-6">
                  <SectionHead
                    title="Service record"
                    lead="Coal Citations come from missed shipping deadlines without tracking. Each mission you complete removes one."
                  />
                  <dl className="kk-meta" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                    <div>
                      <dt>Coal Citations</dt>
                      <dd>{record.coalCitations}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{statusLabel(record.accountStatus)}</dd>
                    </div>
                    {record.missionCount !== null && (
                      <div>
                        <dt>Missions</dt>
                        <dd>{record.missionCount}</dd>
                      </div>
                    )}
                  </dl>
                  <div className={`kk-banner kk-banner--${standing.tone}`}>
                    <Icon name="shield" size={20} />
                    <span>
                      <strong>{standing.title}</strong> {standing.text}
                    </span>
                  </div>
                </section>

                <section className="kk-card flex flex-wrap justify-between items-center gap-4 !border-kk-danger" aria-labelledby="pf-delete">
                  <div className="flex flex-col gap-1 min-w-0 flex-[1_1_260px]">
                    <h2 id="pf-delete" className="m-0 font-display text-lg leading-6 font-semibold text-kk-heading">
                      Delete account
                    </h2>
                    <p className={LEAD}>Removes your profile and wishlists for good. The next page shows anything you need to finish first.</p>
                  </div>
                  <Link href="/delete-account" className="kk-btn kk-btn--danger">
                    <Icon name="trash" />
                    Delete account
                  </Link>
                </section>

                {(dirty || savedNote || saveError) && (
                  <div className="kk-savebar" role="region" aria-label="Unsaved changes">
                    <span className={`kk-savebar__note ${saveError ? '!text-kk-danger' : ''}`} role="status" aria-live="polite">
                      {saveError || (dirty ? `${changes.length} unsaved ${changes.length === 1 ? 'change' : 'changes'}` : 'Changes saved')}
                    </span>
                    {dirty && (
                      <>
                        <button type="button" onClick={discard} disabled={saving} className="kk-btn kk-btn--ghost">
                          Discard
                        </button>
                        <button type="submit" disabled={saving} className="kk-btn kk-btn--primary">
                          <Icon name="check" />
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </form>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}

