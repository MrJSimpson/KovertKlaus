'use client';

/**
 * @file HomePage.tsx
 * @description The public front page of the visual refresh (design canvas "Home · desktop / phone").
 *
 * Tier 1 (what): Hero (pitch, Start a mission, Join with a code, example mission file on the desk
 * art), the four stages with their art, three reasons, and a closing call to action.
 * Tier 2 (why): Sign in and Create account moved to their own page (owner decision 2026-11-18), so
 * the front page explains KovertKlaus to visitors and search engines instead of holding forms.
 * Tier 3 (how): Static content plus the live config for the agent limit and the North Pole banner.
 * "Start a mission" goes through sign-up to the dashboard's create dialog (`src/lib/auth-flow.ts`).
 * The mission file in the hero is an illustration: hidden from screen readers, described once.
 * Copy differs from the mockup where the mockup promised more than the app does: reminders are
 * Head Elf nudges, not automatic.
 */

import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { PLATFORM_LIMIT_BOUNDS } from '@/lib/platform-limits';
import { Illustration } from '@/components/art/Illustration';
import type { IllustrationName } from '@/components/art/illustrations';
import { Icon, type IconName } from '@/components/brand/Icon';
import { JoinCodeButton } from '@/components/brand/JoinCodeDialog';
import { PublicShell } from '@/components/brand/PublicShell';
import { GuideCards } from '@/components/guides/GuideArticle';

const START_HREF = '/register?next=start';

const STAGES: { n: 1 | 2 | 3 | 4; title: string; art: IllustrationName; text: string }[] = [
  { n: 1, title: 'RSVP', art: 'rsvp', text: 'The Head Elf opens a mission and shares one invite link. Agents join, take a codename and build a Wishlist Manifest.' },
  { n: 2, title: 'Match', art: 'match', text: 'On Assignment Day KovertKlaus draws one gift circle. Each agent learns only their own target.' },
  { n: 3, title: 'Sleigh', art: 'sleigh', text: 'Agents ship before the deadline and add tracking, which also protects them from Coal Citations.' },
  { n: 4, title: 'Party', art: 'party', text: 'Gifts are opened, Santas are guessed, and agents post thank-yous in the After-Action Report.' },
];

const REASONS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'mask', title: 'Names stay secret', text: 'Agents see codenames. Only the Head Elf sees who is behind each one, so they can confirm everyone who joined.' },
  { icon: 'package', title: 'Wishlists that ship', text: 'Paste a store link and KovertKlaus fills in the item. Sizes, allergies and dislikes travel with the list.' },
  { icon: 'clock', title: 'Deadlines that hold', text: 'Every stage has a date, and the Head Elf can nudge anyone who is behind. Agents who ship with tracking are protected from Coal Citations.' },
];

const STAGE_BADGE = ['', 'bg-kk-stage1 text-kk-on-stage1', 'bg-kk-stage2 text-kk-on-stage2', 'bg-kk-stage3 text-kk-on-stage3', 'bg-kk-stage4 text-kk-on-stage4'];

/** The example mission file in the hero (illustration, not a real mission). */
function ExampleMissionFile() {
  const steps = [
    { label: 'RSVP', state: 'is-done', dot: '✓' },
    { label: 'Match', state: 'is-current', dot: '2' },
    { label: 'Sleigh', state: '', dot: '3' },
    { label: 'Party', state: '', dot: '4' },
  ];
  return (
    <article className="kk-card kk-file relative z-[1]" aria-hidden="true">
      <div className="kk-file__tab">
        <span>Mission file · KK-2041</span>
        <span>Opened 01 Nov</span>
      </div>
      <div className="kk-file__body">
        <div className="kk-file__head">
          <div>
            <p className="kk-file__eyebrow">Holiday Mission · Secret Santa</p>
            <h3 className="kk-file__title">Operation Snowfall</h3>
          </div>
          <span className="kk-stamp">Head Elf</span>
        </div>
        <ol className="kk-timeline">
          {steps.map((s) => (
            <li key={s.label} className={`kk-timeline__step ${s.state}`}>
              <span className="kk-timeline__dot">{s.dot}</span>
              <span className="kk-timeline__label">{s.label}</span>
            </li>
          ))}
        </ol>
        <dl className="kk-meta">
          <div>
            <dt>Budget</dt>
            <dd>$25–$50</dd>
          </div>
          <div>
            <dt>Ship by</dt>
            <dd>12 DEC</dd>
          </div>
          <div>
            <dt>Agents</dt>
            <dd>8 / 25</dd>
          </div>
        </dl>
        <p className="m-0">
          Targets are drawn. Your target is <span className="kk-redact">Hidden name</span>. Their Wishlist Manifest is ready.
        </p>
        <div className="kk-file__actions">
          <span className="kk-btn kk-btn--primary">
            <Icon name="target" />
            See my target
          </span>
          <span className="kk-btn kk-btn--ghost">
            <Icon name="send" />
            Mission Comms
          </span>
        </div>
      </div>
    </article>
  );
}

export function HomePage() {
  const { systemConfig, bannerActive, bannerText } = useTheme();
  const minAgents = PLATFORM_LIMIT_BOUNDS.maxMissionAgents.min;
  const maxAgents = systemConfig.maxMissionAgents;

  return (
    <PublicShell bare banner={bannerActive ? bannerText : null}>
      <main className="mx-auto max-w-[1200px] px-4 md:px-8 pt-8 md:pt-16 pb-14 md:pb-20 flex flex-col gap-16 md:gap-24">
        {/* Hero */}
        <section className="flex flex-wrap items-center gap-10 md:gap-14" aria-labelledby="home-h">
          <div className="flex-[1_1_440px] flex flex-col gap-5 min-w-0">
            <p className="eyebrow m-0 uppercase text-kk-stamp">Classified // Holiday Mission</p>
            <h1 id="home-h" className="m-0 font-display font-bold text-kk-heading text-balance text-[36px] leading-10 md:text-5xl md:leading-[52px] tracking-[-0.02em]">
              Run your Secret Santa like a covert operation.
            </h1>
            <p className="m-0 text-[17px] leading-[26px] max-w-[34em] text-kk-muted">
              Invite family, friends or coworkers with one link. KovertKlaus draws the targets, keeps every name hidden until the reveal, and tracks each gift to the door.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link href={START_HREF} className="kk-btn kk-btn--primary w-full sm:w-auto">
                <Icon name="plus" />
                Start a mission
              </Link>
              <JoinCodeButton className="kk-btn kk-btn--ghost w-full sm:w-auto">
                <Icon name="ticket" />
                Join with an invite code
              </JoinCodeButton>
            </div>
            <p className="m-0 text-[13px] leading-5 text-kk-muted">
              Secret Santa and White Elephant · {minAgents} to {maxAgents} agents per mission
            </p>
          </div>
          <figure className="m-0 flex-[1_1_440px] max-w-[580px] w-full min-w-0">
            <div className="relative px-2 pt-10 pb-12 sm:pl-7 sm:pr-9 sm:pt-12 sm:pb-16">
              <div className="absolute inset-0 z-0">
                <Illustration name="hero" />
              </div>
              <ExampleMissionFile />
            </div>
            <figcaption className="sr-only">Example: a Secret Santa mission file at the Match stage, with the target&apos;s name hidden.</figcaption>
          </figure>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="flex flex-col gap-7 scroll-mt-6" aria-labelledby="how-h">
          <div className="flex flex-col gap-2">
            <p className="eyebrow m-0 uppercase text-kk-muted">How a mission runs</p>
            <h2 id="how-h" className="m-0 font-display font-bold text-kk-heading text-balance text-[28px] leading-[34px] md:text-4xl md:leading-10">
              Four stages, from invite to unwrapping
            </h2>
          </div>
          <ol className="list-none m-0 p-0 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((s) => (
              <li key={s.n} className="kk-card flex flex-row sm:flex-col gap-4 p-4 sm:p-5">
                <div className="h-[72px] w-24 sm:w-auto sm:h-[120px] shrink-0 px-2 py-1 bg-kk-inset rounded-[var(--kk-radius-md)]">
                  <Illustration name={s.art} />
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                  <h3 className="m-0 font-display text-lg leading-6 font-semibold text-kk-heading flex items-center gap-2.5">
                    <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center font-mono text-[13px] font-semibold ${STAGE_BADGE[s.n]}`} aria-hidden="true">
                      {s.n}
                    </span>
                    <span>
                      <span className="sr-only">Stage {s.n}: </span>
                      {s.title}
                    </span>
                  </h3>
                  <p className="m-0 text-kk-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          {/* Owner request 2026-11-19: the stages link to the full walkthrough. */}
          <Link href="/guides/how-a-mission-runs" className="kk-btn kk-btn--secondary self-start">
            Read the full guide
          </Link>
        </section>

        {/* Why */}
        <section aria-label="Why KovertKlaus" className="grid gap-8 md:gap-10 grid-cols-1 md:grid-cols-3 p-6 md:p-10 bg-kk-surface border border-kk-border rounded-[var(--kk-radius-lg)]">
          {REASONS.map((r) => (
            <div key={r.title} className="flex flex-col gap-2.5">
              <span className="w-11 h-11 rounded-[var(--kk-radius-md)] grid place-items-center bg-kk-inset border border-kk-border text-kk-stamp">
                <Icon name={r.icon} size={22} />
              </span>
              <h3 className="m-0 font-display text-lg leading-6 font-semibold text-kk-heading">{r.title}</h3>
              <p className="m-0 text-kk-muted">{r.text}</p>
            </div>
          ))}
        </section>

        {/* Call to action */}
        <section className="flex flex-wrap items-center justify-between gap-6 p-6 md:p-10 rounded-[var(--kk-radius-lg)] bg-kk-header text-kk-on-header" aria-labelledby="cta-h">
          <div className="flex flex-col gap-1.5">
            <h2 id="cta-h" className="m-0 font-display text-[28px] leading-[34px] font-bold text-kk-on-header">
              Your mission starts with one link.
            </h2>
            <p className="m-0 opacity-90">Set a budget and dates, invite your agents, and let KovertKlaus handle the secrets.</p>
          </div>
          <Link href={START_HREF} className="kk-btn kk-btn--primary w-full sm:w-auto">
            Start a mission
          </Link>
        </section>

        {/* Guides (owner decision 2026-11-19: a strip of guide cards above the footer) */}
        <section className="flex flex-col gap-5" aria-labelledby="guides-h">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="guides-h" className="m-0 font-display text-[24px] leading-[30px] font-semibold text-kk-heading">
              Guides for your exchange
            </h2>
            <Link href="/guides" className="font-semibold">
              All guides
            </Link>
          </div>
          <GuideCards headingLevel="h3" />
        </section>
      </main>
    </PublicShell>
  );
}
