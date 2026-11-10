/**
 * @file layout.tsx (/opkits)
 * @description Keeps this private page out of search results (`NOINDEX`, `src/lib/seo.ts`).
 */
import { NOINDEX } from '@/lib/seo';

export const metadata = NOINDEX;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
