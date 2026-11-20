/**
 * @file Wordmark.tsx
 * @description The KovertKlaus wordmark: the briefcase stamp beside "KovertKlaus" in Space Grotesk.
 *
 * Tier 1 (what): Renders the Design System `Wordmark` (`kk-wordmark`), optionally as a link home.
 * Tier 2 (why): Replaces the 🎁 tile and "KOVERT KLAUS" text in every header (visual refresh,
 * 2.0.0-beta). The stamp and "Klaus" take `kk-stamp`, "Kovert" takes `kk-heading`; on the header
 * both turn `kk-on-header`, so the mark follows the season with one ink.
 * Tier 3 (how): The mark is inlined from `brandMarkSvg` (static markup, no user data) with a mask id
 * from `useId`, so two wordmarks on one page never share a mask. The SVG is decorative; the name is
 * the accessible text.
 */

import Link from 'next/link';
import { useId } from 'react';
import { brandMarkSvg } from '@/lib/brand-mark';

export interface WordmarkProps {
  /** `sm` 18px (phone header), `md` 24px (desktop header), `lg` 40px (landing, sign-in). */
  size?: 'sm' | 'md' | 'lg';
  /** On `kk-header`: stamp and name in `kk-on-header`. */
  onHeader?: boolean;
  /** Link target; omit for a plain mark. */
  href?: string;
  className?: string;
}

const SIZE_CLASS = { sm: 'kk-wordmark--sm', md: '', lg: 'kk-wordmark--lg' } as const;

export function Wordmark({ size = 'md', onHeader = false, href, className = '' }: WordmarkProps) {
  const maskId = `kk-mark-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const classes = ['kk-wordmark', SIZE_CLASS[size], onHeader ? 'kk-wordmark--on-header' : '', className]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="kk-wordmark__icon" dangerouslySetInnerHTML={{ __html: brandMarkSvg(maskId, 'aria-hidden="true" focusable="false"') }} />
      <span>
        Kovert<span className="kk-wordmark__second">Klaus</span>
      </span>
    </>
  );

  return href ? (
    <Link href={href} className={classes} aria-label="KovertKlaus home">
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
