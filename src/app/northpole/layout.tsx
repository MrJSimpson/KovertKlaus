/**
 * @file layout.tsx (/northpole)
 * @description Server layout: keeps every /northpole page out of search results, then renders the client shell.
 *
 * Tier 1 (what): Exports `NOINDEX` metadata and wraps the pages in `NorthPoleShell`.
 * Tier 2 (why): Metadata can only come from a server component, and the shell is a client component.
 * Tier 3 (how): The former client layout moved unchanged into `NorthPoleShell.tsx`.
 */
import { NOINDEX } from '@/lib/seo';
import NorthPoleShell from './NorthPoleShell';

export const metadata = NOINDEX;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <NorthPoleShell>{children}</NorthPoleShell>;
}
