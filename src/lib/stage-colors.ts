/**
 * @file stage-colors.ts
 * @description Mission stage color system shared by the 4-stage timeline and every status badge.
 *
 * Tier 1 (what): Maps a timeline stage (1 RSVP, 2 Match, 3 Sleigh, 4 Party) and its state
 * (done, current, upcoming) to Tailwind classes built on the `kk-stage*` tokens in `globals.css`.
 * Tier 2 (why): A stage keeps one hue everywhere (timeline card, mission status badge, list cards),
 * so "gold means RSVP" reads the same on every page and in both modes. The hue says which stage;
 * the fill strength says where the mission is.
 * Tier 3 (how): Light mode uses gold, holly red, evergreen and pine with tinted cards; dark mode uses
 * jewel tones on indigo (gold, rose cranberry, mint evergreen, ice blue) with a colored top stripe on
 * plain cards, because tints turn muddy on dark surfaces. Only the current stage is filled in both.
 * Class strings are written out in full so Tailwind can find them.
 */

/** Timeline stage: 1 RSVP cutoff, 2 Secret Santa match, 3 sleigh departure (shipping), 4 exchange party. */
export type MissionStage = 1 | 2 | 3 | 4;

/** Where a stage sits relative to the mission's current stage. */
export type StageState = 'done' | 'current' | 'upcoming';

interface StageClassSet {
  /** Current stage: solid fill, ring, and text colored for the fill. */
  current: string;
  /** Finished stage: soft tint with an accent border. */
  done: string;
  /** Future stage: plain surface with a dashed accent border. */
  upcoming: string;
  /** Small solid pill (stage number, status badge). */
  pill: string;
  /** Soft pill for finished missions. */
  pillSoft: string;
}

const STAGE_CLASSES: Record<MissionStage, StageClassSet> = {
  1: {
    current: 'bg-kk-stage1 text-kk-on-stage1 border-2 border-kk-stage1-accent ring-2 ring-kk-stage1-accent/40 shadow-md',
    done: 'bg-kk-stage1-soft text-kk-ink border-2 border-kk-stage1-accent/60 dark:bg-kk-surface dark:border-kk-border dark:border-t-[6px] dark:border-t-kk-stage1',
    upcoming: 'bg-kk-surface text-kk-ink border-2 border-dashed border-kk-stage1-accent dark:border-kk-border dark:border-t-[6px] dark:border-t-kk-stage1',
    pill: 'bg-kk-stage1 text-kk-on-stage1 border border-kk-stage1-accent',
    pillSoft: 'bg-kk-stage1-soft text-kk-ink border border-kk-stage1-accent',
  },
  2: {
    current: 'bg-kk-stage2 text-kk-on-stage2 border-2 border-kk-stage2-accent ring-2 ring-kk-stage2-accent/40 shadow-md',
    done: 'bg-kk-stage2-soft text-kk-ink border-2 border-kk-stage2-accent/60 dark:bg-kk-surface dark:border-kk-border dark:border-t-[6px] dark:border-t-kk-stage2',
    upcoming: 'bg-kk-surface text-kk-ink border-2 border-dashed border-kk-stage2-accent dark:border-kk-border dark:border-t-[6px] dark:border-t-kk-stage2',
    pill: 'bg-kk-stage2 text-kk-on-stage2 border border-kk-stage2-accent',
    pillSoft: 'bg-kk-stage2-soft text-kk-ink border border-kk-stage2-accent',
  },
  3: {
    current: 'bg-kk-stage3 text-kk-on-stage3 border-2 border-kk-stage3-accent ring-2 ring-kk-stage3-accent/40 shadow-md',
    done: 'bg-kk-stage3-soft text-kk-ink border-2 border-kk-stage3-accent/60 dark:bg-kk-surface dark:border-kk-border dark:border-t-[6px] dark:border-t-kk-stage3',
    upcoming: 'bg-kk-surface text-kk-ink border-2 border-dashed border-kk-stage3-accent dark:border-kk-border dark:border-t-[6px] dark:border-t-kk-stage3',
    pill: 'bg-kk-stage3 text-kk-on-stage3 border border-kk-stage3-accent',
    pillSoft: 'bg-kk-stage3-soft text-kk-ink border border-kk-stage3-accent',
  },
  4: {
    current: 'bg-kk-stage4 text-kk-on-stage4 border-2 border-kk-stage4-accent ring-2 ring-kk-stage4-accent/40 shadow-md',
    done: 'bg-kk-stage4-soft text-kk-ink border-2 border-kk-stage4-accent/60 dark:bg-kk-surface dark:border-kk-border dark:border-t-[6px] dark:border-t-kk-stage4',
    upcoming: 'bg-kk-surface text-kk-ink border-2 border-dashed border-kk-stage4-accent dark:border-kk-border dark:border-t-[6px] dark:border-t-kk-stage4',
    pill: 'bg-kk-stage4 text-kk-on-stage4 border border-kk-stage4-accent',
    pillSoft: 'bg-kk-stage4-soft text-kk-ink border border-kk-stage4-accent',
  },
};

/**
 * Where `stage` sits for a mission currently in `currentStage`.
 *
 * @param stage - The timeline stage being drawn
 * @param currentStage - The mission's current stage (`getNextMilestoneCountdown().stage`)
 * @param isComplete - True once the mission is over: every stage is done
 */
export function stageState(stage: MissionStage, currentStage: MissionStage, isComplete = false): StageState {
  if (isComplete || stage < currentStage) return 'done';
  if (stage === currentStage) return 'current';
  return 'upcoming';
}

/** Card classes for one timeline stage in the given state. */
export function stageCardClass(stage: MissionStage, state: StageState): string {
  return STAGE_CLASSES[stage][state];
}

/** Solid pill classes for a stage (stage number chips). */
export function stagePillClass(stage: MissionStage): string {
  return STAGE_CLASSES[stage].pill;
}

/**
 * Status badge classes for a mission: the current stage's hue, solid while the mission runs,
 * soft once it is complete.
 */
export function statusBadgeClass(phase: { stage: MissionStage; isComplete: boolean }): string {
  return phase.isComplete ? STAGE_CLASSES[phase.stage].pillSoft : STAGE_CLASSES[phase.stage].pill;
}

/**
 * Countdown pill classes: the current stage's hue, soft normally, solid within 7 days,
 * pulsing on the day itself.
 */
export function countdownBadgeClass(phase: { stage: MissionStage; isComplete: boolean; isToday: boolean; isPast: boolean; daysLeft: number }): string {
  const set = STAGE_CLASSES[phase.stage];
  if (phase.isComplete) return set.pillSoft;
  if (phase.isToday) return `${set.pill} motion-safe:animate-pulse`;
  if (!phase.isPast && phase.daysLeft <= 7) return set.pill;
  return set.pillSoft;
}
