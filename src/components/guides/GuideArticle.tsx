/**
 * @file GuideArticle.tsx
 * @description Renders one how-to guide, and the guide cards used on `/guides` and the front page.
 *
 * Tier 1 (what): `GuideArticle` (heading, lead, illustration, content blocks, a "start a mission"
 * card and links to the other guides) and `GuideCards` (one card per guide).
 * Tier 2 (why): The guides had no mockup; they reuse the visual refresh parts of the public pages
 * (`kk-card`, illustrations, the front page's call-to-action band) so they match the rest of the site.
 * Tier 3 (how): Content comes from `src/lib/guides.ts`. External links open in a new tab; code
 * blocks scroll sideways inside their box on phones instead of widening the page.
 */

import Link from 'next/link';
import { Illustration } from '@/components/art/Illustration';
import { Icon } from '@/components/brand/Icon';
import { GUIDES, type Guide, type GuideBlock, type Inline } from '@/lib/guides';

const H1 = 'm-0 font-display font-bold text-kk-heading text-balance text-[32px] leading-[38px] md:text-[44px] md:leading-[50px]';
const EYEBROW = 'm-0 font-display text-xs leading-4 font-semibold tracking-[0.12em] uppercase text-kk-muted';

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === 'string') return <span key={i}>{p}</span>;
        if ('strong' in p) return <strong key={i} className="font-semibold text-kk-heading">{p.strong}</strong>;
        if ('code' in p) return <code key={i} className="font-mono text-[0.9em] px-1 py-0.5 rounded-[var(--kk-radius-sm)] bg-kk-inset border border-kk-border break-words">{p.code}</code>;
        const external = p.href.startsWith('http');
        return external ? (
          <a key={i} href={p.href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {p.text}
          </a>
        ) : (
          <Link key={i} href={p.href} className="underline underline-offset-2">
            {p.text}
          </Link>
        );
      })}
    </>
  );
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case 'h2':
      return <h2 className="m-0 mt-4 font-display text-[24px] leading-[30px] font-semibold text-kk-heading">{block.text}</h2>;
    case 'p':
      return (
        <p className="m-0">
          <InlineText parts={block.text} />
        </p>
      );
    case 'ul':
    case 'ol': {
      const List = block.type;
      return (
        <List className={`m-0 pl-6 flex flex-col gap-2 ${block.type === 'ol' ? 'list-decimal' : 'list-disc'} marker:text-kk-muted`}>
          {block.items.map((item, i) => (
            <li key={i} className="pl-1">
              <InlineText parts={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'code':
      return (
        <pre className="m-0 p-4 overflow-x-auto bg-kk-inset border border-kk-border rounded-[var(--kk-radius-md)] font-mono text-sm leading-6">
          <code>{block.lines.join('\n')}</code>
        </pre>
      );
    case 'note':
      return (
        <p className="kk-banner kk-banner--warning m-0">
          <Icon name="alert" size={20} />
          <span>
            <InlineText parts={block.text} />
          </span>
        </p>
      );
    case 'examples':
      return (
        <ul className="list-none m-0 p-0 grid gap-3">
          {block.items.map((ex) => (
            <li key={ex.title} className="kk-card flex gap-3 items-start p-4">
              <span
                className={`w-8 h-8 shrink-0 rounded-full grid place-items-center ${ex.works ? 'bg-kk-success text-kk-on-success' : 'bg-kk-danger-soft text-kk-on-danger-soft'}`}
              >
                <Icon name={ex.works ? 'check' : 'ban'} label={ex.works ? 'Works' : 'Refused'} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-kk-heading">{ex.title}</span>
                <span className="block text-kk-muted">{ex.text}</span>
              </span>
            </li>
          ))}
        </ul>
      );
  }
}

/** One card per guide (all of them, or all but `except`). */
export function GuideCards({ except, headingLevel = 'h2' }: { except?: string; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <ul className={`list-none m-0 p-0 grid gap-5 grid-cols-1 ${except ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
      {GUIDES.filter((g) => g.slug !== except).map((g) => (
        <li key={g.slug} className="kk-card relative flex flex-col gap-3 p-5">
          <div className="h-[100px] px-2 py-1 bg-kk-inset rounded-[var(--kk-radius-md)]">
            <Illustration name={g.art} />
          </div>
          <Heading className="m-0 font-display text-lg leading-6 font-semibold text-kk-heading">
            {/* The whole card is clickable; the link text is the guide title. */}
            <Link href={g.path} className="no-underline text-inherit after:absolute after:inset-0 after:content-['']">
              {g.title}
            </Link>
          </Heading>
          <p className="m-0 text-kk-muted flex-1">{g.summary}</p>
          <span className="font-semibold text-kk-primary inline-flex items-center gap-1" aria-hidden="true">
            Read the guide →
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A full guide page body (inside `PublicShell`). */
export function GuideArticle({ guide }: { guide: Guide }) {
  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <article className="flex flex-col gap-8">
        <header className="flex flex-wrap items-center gap-8">
          <div className="flex flex-col gap-3 flex-[1_1_420px] min-w-0">
            <Link href="/guides" className="self-start text-sm font-semibold no-underline hover:underline">
              ← All guides
            </Link>
            <p className={EYEBROW}>Guide</p>
            <h1 className={H1}>{guide.title}</h1>
            <p className="m-0 text-[17px] leading-[27px] text-kk-muted max-w-[38em]">{guide.lead}</p>
          </div>
          <div className="flex-[0_1_300px] h-[160px] md:h-[200px] px-3 py-2 bg-kk-inset border border-kk-border rounded-[var(--kk-radius-lg)] hidden sm:block">
            <Illustration name={guide.art} />
          </div>
        </header>
        <div className="flex flex-col gap-4 max-w-[44em] text-[16px] leading-[26px]">
          {guide.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </div>
      </article>

      <section className="flex flex-wrap items-center justify-between gap-6 p-6 md:p-10 rounded-[var(--kk-radius-lg)] bg-kk-header text-kk-on-header" aria-labelledby="guide-cta-h">
        <div className="flex flex-col gap-1.5">
          <h2 id="guide-cta-h" className="m-0 font-display text-[26px] leading-[32px] font-bold text-kk-on-header">
            Ready when you are.
          </h2>
          <p className="m-0 opacity-90">Free, private, and set up in a couple of minutes.</p>
        </div>
        <Link href={guide.cta.href} className="kk-btn kk-btn--primary w-full sm:w-auto">
          {guide.cta.label}
        </Link>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="more-guides-h">
        <h2 id="more-guides-h" className="m-0 font-display text-[24px] leading-[30px] font-semibold text-kk-heading">
          More guides
        </h2>
        <GuideCards except={guide.slug} headingLevel="h3" />
      </section>
    </div>
  );
}
