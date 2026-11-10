/**
 * @file layout.tsx (/features)
 * @description Title, description and canonical link for the public features page.
 *
 * Tier 1 (what): Exports the page metadata; renders the page unchanged.
 * Tier 2 (why): The page is a client component, and metadata can only come from a server component.
 */
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata(
  '/features',
  'Features | KovertKlaus',
  'Everything KovertKlaus does for Secret Santa and White Elephant exchanges: a fair draw, private wishlists, shipping tracking, in-person White Elephant and free self-hosting.',
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
