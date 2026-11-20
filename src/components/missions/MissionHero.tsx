'use client';

/**
 * @file MissionHero.tsx
 * @description The mission file at the top of the mission page (design canvas "Mission page").
 *
 * Tier 1 (what): Folder tab (code, opened date), eyebrow, title, "You are" codename (with Draw
 * another / Accept while that is allowed), the Head Elf's codename for agents, role stamp, the
 * four-stage timeline, Budget / date / Agents, and a status banner. Copy code for sharing.
 * Tier 2 (why): Visual refresh (2.0.0-beta): one mission file replaces the old banner, codename card
 * and stage cards, and says the same thing as the mission's dashboard card.
 * Tier 3 (how): Stamp, timeline, dates and status come from `missionCardView` (src/lib/mission-card.ts),
 * the dashboard card's own logic, so the two never disagree. Cancelled missions show the void stamp.
 */

import { useState } from 'react';
import { Icon } from '@/components/brand/Icon';
import { missionCardView, type MissionListItem, type StepState } from '@/lib/mission-card';

const STEP_LABELS = ['RSVP', 'Match', 'Sleigh', 'Party'];
const STEP_CLASS: Record<StepState, string> = { done: 'is-done', current: 'is-current', upcoming: '' };

export interface MissionHeroProps {
  mission: MissionListItem;
  description?: string | null;
  /** Local in-person event: where it happens. */
  location?: string | null;
  /** The Head Elf's codename, shown to agents ("Head Elf AGENT X"). */
  headElfCodename?: string | null;
  /** The viewer's codename and whether they may still change it. */
  codename?: { value: string; canReroll: boolean; busy: boolean; onReroll: () => void; onAccept: () => void } | null;
}

function chipText(codename: string): string {
  return codename.replace(/^Agent:\s*/i, '').toUpperCase().replace(/\s+/g, '-');
}

export function MissionHero({ mission, description, location, headElfCodename, codename }: MissionHeroProps) {
  const card = missionCardView(mission);
  const [copied, setCopied] = useState(false);
  const isHeadElf = Boolean(mission.viewer?.isHeadElf);
  const tone = card.cancelled ? 'danger' : card.stamp.tone === 'danger' ? 'warning' : 'success';
  const currentIndex = card.steps.indexOf('current');

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(mission.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const timeline = (
    <ol
      className="kk-timeline"
      aria-label={card.cancelled ? 'Mission stage: cancelled' : `Mission stage: ${STEP_LABELS[currentIndex] ?? 'complete'}`}
      style={card.cancelled ? { filter: 'grayscale(1)', opacity: 0.4 } : undefined}
    >
      {card.steps.map((state, i) => (
        <li key={STEP_LABELS[i]} className={`kk-timeline__step ${STEP_CLASS[state]}`} aria-current={state === 'current' ? 'step' : undefined}>
          <span className="kk-timeline__dot">{state === 'done' ? '✓' : i + 1}</span>
          <span className="kk-timeline__label">{STEP_LABELS[i]}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <section className="kk-card kk-file" aria-labelledby="mission-title">
      <div className="kk-file__tab">
        <span>
          <span className="max-sm:hidden">Mission file · </span>
          {mission.code}
        </span>
        <span>{card.tabDate}</span>
      </div>
      <div className="kk-file__body gap-5">
        <div className="kk-file__head flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="kk-file__eyebrow">Holiday Mission · {mission.isWhiteElephant ? 'White Elephant' : 'Secret Santa'}</p>
            <h1 id="mission-title" className="m-0 font-display font-bold text-kk-heading text-balance break-words text-[28px] leading-[34px] md:text-4xl md:leading-10">
              {mission.title}
            </h1>
            {description && <p className="m-0 text-kk-muted max-w-[65ch]">{description}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {codename && (
                <span className={`kk-codename${isHeadElf ? ' kk-codename--gold' : ''}`}>
                  <span className="kk-codename__label">You are</span>
                  {chipText(codename.value)}
                </span>
              )}
              {!isHeadElf && headElfCodename && (
                <span className="kk-codename">
                  <span className="kk-codename__label">Head Elf</span>
                  {chipText(headElfCodename)}
                </span>
              )}
              {location && (
                <span className="kk-pill kk-pill--neutral">
                  In person · <span className="break-all">{location}</span>
                </span>
              )}
            </div>
            {codename?.canReroll && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[13px] text-kk-muted">Not a fit? Draw another until you accept.</span>
                <button type="button" disabled={codename.busy} onClick={codename.onReroll} className="kk-btn kk-btn--ghost kk-btn--sm">
                  Draw another
                </button>
                <button type="button" disabled={codename.busy} onClick={codename.onAccept} className="kk-btn kk-btn--secondary kk-btn--sm">
                  <Icon name="check" />
                  Accept codename
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className={`kk-stamp${card.stamp.tone === 'muted' ? ' kk-stamp--muted' : card.stamp.tone === 'danger' ? ' kk-stamp--danger' : ''}`}>{card.stamp.label}</span>
            <button type="button" onClick={copyCode} className="kk-btn kk-btn--ghost kk-btn--sm" aria-live="polite">
              {copied ? 'Code copied' : 'Copy code'}
            </button>
          </div>
        </div>

        {card.cancelled ? (
          <div className="relative">
            {timeline}
            <span className="kk-stamp kk-stamp--danger kk-stamp--void" aria-hidden="true">
              Cancelled
            </span>
          </div>
        ) : (
          timeline
        )}

        <dl className="kk-meta">
          {card.meta.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className={`kk-banner kk-banner--${tone}`} role="status">
          <Icon name={tone === 'success' ? 'check' : 'alert'} size={20} />
          <span>
            {card.lead && <strong>{card.lead} </strong>}
            {card.status}
          </span>
        </div>
      </div>
    </section>
  );
}
