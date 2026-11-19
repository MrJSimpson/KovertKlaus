/**
 * @file MissionFileCard.tsx
 * @description One Holiday Mission as a mission file on the dashboard (Design System `MissionFile`).
 *
 * Tier 1 (what): Folder tab (code + opened/cancelled date), eyebrow, title, state stamp, four-step
 * timeline, Budget / date / Agents, one status sentence, and one primary plus one secondary link.
 * Tier 2 (why): The visual refresh (2.0.0-beta) shows each agent the next thing *they* need to do
 * in each mission. Cancelled missions use the chosen "void stamp" design (option B, 2026-10-31):
 * the timeline greys out under a CANCELLED stamp and the reason is bold red.
 * Tier 3 (how): Pure presentation of `missionCardView` (src/lib/mission-card.ts). Buttons are links
 * into the mission page; on narrow cards they stack full width (container query in the CSS).
 */

import Link from 'next/link';
import { Icon } from '@/components/brand/Icon';
import { missionCardView, type MissionListItem, type StepState } from '@/lib/mission-card';

const STEP_LABELS = ['RSVP', 'Match', 'Sleigh', 'Party'];
const STEP_CLASS: Record<StepState, string> = { done: 'is-done', current: 'is-current', upcoming: '' };

export function MissionFileCard({ mission }: { mission: MissionListItem }) {
  const card = missionCardView(mission);
  const currentIndex = card.steps.indexOf('current');
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
    <article className="kk-card kk-file" aria-labelledby={`mf-${mission.id}`}>
      <div className="kk-file__tab">
        <span>Mission file · {mission.code}</span>
        <span>{card.tabDate}</span>
      </div>
      <div className="kk-file__body">
        <div className="kk-file__head">
          <div className="min-w-0">
            <p className="kk-file__eyebrow">Holiday Mission · {mission.isWhiteElephant ? 'White Elephant' : 'Secret Santa'}</p>
            <h3 id={`mf-${mission.id}`} className="kk-file__title break-words">
              {mission.title}
            </h3>
          </div>
          <span className={`kk-stamp${card.stamp.tone === 'muted' ? ' kk-stamp--muted' : card.stamp.tone === 'danger' ? ' kk-stamp--danger' : ''}`}>{card.stamp.label}</span>
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

        <p className="m-0">
          {card.lead && <strong className={card.cancelled ? 'text-kk-danger font-bold' : 'font-semibold'}>{card.lead} </strong>}
          {card.status}
        </p>

        <div className="kk-file__actions">
          <Link href={card.primary.href} className={`kk-btn kk-btn--${card.primary.variant}`}>
            {card.primary.icon && <Icon name={card.primary.icon} />}
            {card.primary.label}
          </Link>
          {card.secondary && (
            <Link href={card.secondary.href} className="kk-btn kk-btn--ghost">
              {card.secondary.icon && <Icon name={card.secondary.icon} />}
              {card.secondary.label}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
