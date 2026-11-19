/**
 * @file Illustration.tsx
 * @description Renders one piece of the refresh's spot art (`illustrations.ts`).
 *
 * Tier 1 (what): `<Illustration name="rsvp" />` draws the SVG at the container's width.
 * Tier 2 (why): The art carries meaning in the how-it-works stages and is decoration elsewhere
 * (hero, empty states); screen readers should hear the first and skip the second.
 * Tier 3 (how): Art with an entry in `ILLUSTRATION_LABELS` gets `role="img"` and that label; the
 * rest is `aria-hidden`. The markup is static project art, never user data.
 */

import { ILLUSTRATIONS, ILLUSTRATION_LABELS, type IllustrationName } from './illustrations';

export function Illustration({ name, className, height }: { name: IllustrationName; className?: string; height?: number | string }) {
  const art = ILLUSTRATIONS[name];
  const label = ILLUSTRATION_LABELS[name];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={art.viewBox}
      width="100%"
      height={height ?? '100%'}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      dangerouslySetInnerHTML={{ __html: art.svg }}
    />
  );
}
