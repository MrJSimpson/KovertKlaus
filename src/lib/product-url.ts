/**
 * @file product-url.ts
 * @description Finds the store link in whatever an agent pasted into a wishlist item's link field.
 *
 * Tier 1 (what): `extractProductUrl` returns the first `http(s)://` link in the text, or a bare
 * domain-style link with `https://` added, or `null` when the text holds no link at all.
 * Tier 2 (why): Phones share "Take a look at this item from Walmart https://…", and agents paste
 * product names ("24 oz black yeti coffee mug") or typos ("etsy,com"). The scraper used to prefix
 * `https://` to the whole text, which failed the URL safety check and was logged as `BLOCKED_SSRF`
 * (8 such rows, 2026-11-14 to 11-16). Pulling the link out first fixes share text and lets the
 * dialog tell the agent what to paste instead of a generic "couldn't read that page".
 * Tier 3 (how): Pure and dependency-free, so the client dialog and both server runtimes share it.
 * The result still goes through `isSafePublicUrl`; this only finds the candidate.
 */

/** First `http://` or `https://` link; stops at whitespace, quotes and angle brackets. */
const LINK_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

/** A bare link such as `amazon.com/dp/B0872N3D7X` or `www.etsy.com/listing/1`: no spaces, a dotted host. */
const BARE_LINK = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;

/** Punctuation a sentence puts right after a link, which is not part of it. */
const TRAILING_PUNCTUATION = /[).,;:!?\]]+$/;

/** What the agent sees when the pasted text holds no link. */
export const NO_LINK_MESSAGE = 'Paste the link to the item (it starts with https://), not its name.';

/**
 * Finds the product link in pasted text.
 *
 * @param input - The raw text from the link field
 * @returns The link (with `https://` added to a bare domain), or `null` when there is none
 */
export function extractProductUrl(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (!text) return null;
  const inText = text.match(LINK_IN_TEXT);
  if (inText) return inText[0].replace(TRAILING_PUNCTUATION, '');
  if (BARE_LINK.test(text)) return `https://${text}`;
  return null;
}
