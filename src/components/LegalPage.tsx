'use client';

/**
 * @file LegalPage.tsx
 * @description Renders a policy page (`/privacy`, `/terms`) from a `LegalDocument`.
 *
 * Tier 1 (what): Header, title, "not commercial yet" notice, table of contents, sections and the
 * CC BY 4.0 attribution for the source policies.
 * Tier 2 (why): Both policies share one layout, so the text lives in `src/lib/legal.ts` and this
 * component only presents it (owner decision 2026-10-31).
 * Tier 3 (how): Section text supports `**bold**` and turns the contact address into a mailto link;
 * nothing else is parsed, so policy text cannot inject markup. Works in the static export.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { LEGAL_ATTRIBUTION, LEGAL_CONTACT_EMAIL, LEGAL_UPDATED, type LegalBlock, type LegalDocument } from '@/lib/legal';

/** Renders `**bold**` runs and the contact address as a mailto link; everything else is plain text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).flatMap((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return [<strong key={`b${i}`} className="text-kk-heading">{part.slice(2, -2)}</strong>];
    return part.split(LEGAL_CONTACT_EMAIL).flatMap((chunk, j, all) =>
      j < all.length - 1
        ? [chunk, <a key={`m${i}-${j}`} href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-kk-accent underline underline-offset-2">{LEGAL_CONTACT_EMAIL}</a>]
        : [chunk]
    );
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === 'p') return <p className="leading-relaxed">{inline(block.text)}</p>;
  return (
    <ul className="list-disc pl-6 space-y-2 leading-relaxed">
      {block.items.map((item, i) => (
        <li key={i}>{inline(item)}</li>
      ))}
    </ul>
  );
}

export function LegalPage({ doc, other }: { doc: LegalDocument; other: { href: string; label: string } }) {
  const { theme } = useTheme();
  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme.pageBg}`}>
      <header className={`border-b transition-colors ${theme.headerBg}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-lg sm:text-xl font-black tracking-tight text-kk-on-header">
            KOVERT KLAUS
          </Link>
          <nav aria-label="Policies" className="flex items-center gap-2">
            <Link href={other.href} className="min-h-11 inline-flex items-center px-3 text-xs font-bold text-kk-on-header underline-offset-4 hover:underline">
              {other.label}
            </Link>
            <Link href="/" className={`min-h-11 inline-flex items-center whitespace-nowrap text-xs font-bold px-4 rounded-xl ${theme.btnPrimary}`}>
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-10 sm:py-14 text-kk-ink">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-kk-heading">{doc.title}</h1>
        <p className="mt-2 text-sm text-kk-muted">Last updated: {LEGAL_UPDATED}</p>

        <div role="note" className="mt-6 rounded-2xl border border-kk-border bg-kk-inset p-4 sm:p-5 text-sm leading-relaxed">
          <strong className="text-kk-heading">Not a commercial product (yet). </strong>
          {doc.notice}
        </div>

        <p className="mt-6 leading-relaxed">{inline(doc.intro)}</p>

        <nav aria-label="On this page" className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-kk-muted">On this page</h2>
          <ol className="mt-2 list-decimal pl-6 space-y-1 text-sm">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-kk-accent underline-offset-2 hover:underline">{s.heading}</a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-10 scroll-mt-6 space-y-4">
            <h2 id={`${s.id}-h`} className="text-xl sm:text-2xl font-black text-kk-heading">{s.heading}</h2>
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </section>
        ))}

        <p className="mt-12 border-t border-kk-border pt-6 text-xs text-kk-muted">
          {LEGAL_ATTRIBUTION.text} (
          <a href={LEGAL_ATTRIBUTION.sourceUrl} target="_blank" rel="noreferrer" className="underline">source</a>
          ), licensed under{' '}
          <a href={LEGAL_ATTRIBUTION.licenseUrl} target="_blank" rel="noreferrer" className="underline">{LEGAL_ATTRIBUTION.license}</a>
          . {LEGAL_ATTRIBUTION.changes}
        </p>
      </main>
    </div>
  );
}
