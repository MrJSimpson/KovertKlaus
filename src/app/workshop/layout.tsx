/**
 * @file layout.tsx (/workshop)
 * @description Server layout: keeps every /workshop page out of search results, then renders the client shell.
 *
 * Tier 1 (what): Exports `NOINDEX` metadata and wraps the pages in `WorkshopShell`.
 * Tier 2 (why): Metadata can only come from a server component, and the shell is a client component.
 * Tier 3 (how): The former client layout moved unchanged into `WorkshopShell.tsx`.
 */
import { NOINDEX } from '@/lib/seo';
import WorkshopShell from './WorkshopShell';

export const metadata = NOINDEX;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <WorkshopShell>{children}</WorkshopShell>;
}
