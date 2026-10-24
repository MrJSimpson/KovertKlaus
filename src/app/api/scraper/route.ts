import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { isSafePublicUrl, sanitizeText, normalizeProductUrl } from '@/lib/security';
import { logScraperEvent } from '@/lib/logger';
import { assertProductTitle, describeFetchFailure, fetchProductPage, isUsableProductTitle } from '@/lib/product-fetch';
import { detectProductCategory, getCategorySuggestedKeys } from '@/lib/product-intelligence';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Valid product URL is required' }, { status: 400 });
    }

    const formattedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;

    // SSRF Security Validation (OWASP A01: SSRF Protection)
    const ssrfCheck = isSafePublicUrl(formattedUrl);
    if (!ssrfCheck.safe) {
      await logScraperEvent(formattedUrl, 'BLOCKED_SSRF', { reason: ssrfCheck.error }).catch(() => {});
      return NextResponse.json({ error: ssrfCheck.error || 'Access to this URL is blocked for security reasons.' }, { status: 403 });
    }


    // Normalize URL to remove tracking parameters
    const normalizedUrl = normalizeProductUrl(formattedUrl);
    const parsedUrl = new URL(normalizedUrl);

    // Step 1: Check shared ProductCatalog in Database (~10ms fast hit)
    let existingCatalog = null;
    try {
      existingCatalog = await db.productCatalog.findUnique({
        where: { url: normalizedUrl },
      });
    } catch {
      // Database connection error, offline test, or cold start - proceed with live scraping
    }
    // Rows saved from bot-check pages before they were detected are ignored (and replaced on success)
    if (existingCatalog && !isUsableProductTitle(existingCatalog.title, existingCatalog.domain || parsedUrl.hostname)) {
      existingCatalog = null;
    }

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const isFresh = existingCatalog && (Date.now() - new Date(existingCatalog.scrapedAt).getTime() < TWENTY_FOUR_HOURS_MS);

    if (existingCatalog && isFresh) {
      const category = (existingCatalog.properties as any)?.category || detectProductCategory(existingCatalog.title, existingCatalog.domain || parsedUrl.hostname, existingCatalog.description || '');
      const variables = (existingCatalog.properties as any)?.variables || getCategorySuggestedKeys(category);
      const properties = existingCatalog.properties || { category, variables, popularOptions: {} };

      return NextResponse.json({
        success: true,
        foundInCatalog: true,
        metadata: {
          id: existingCatalog.id,
          title: existingCatalog.title,
          url: existingCatalog.url,
          price: existingCatalog.price ? Number(existingCatalog.price) : undefined,
          description: existingCatalog.description || undefined,
          thumbnail: existingCatalog.thumbnailUrl || undefined,
          domain: existingCatalog.domain || parsedUrl.hostname,
          properties,
        },
      });
    }

    // Step 2: live fetch within a 2.5 second budget, following only safe redirects
    try {
      const { html } = await fetchProductPage(parsedUrl.toString());
      const $ = cheerio.load(html);

      // Extract & Sanitize Open Graph & Meta Metadata (Stored XSS Prevention)
      const title = sanitizeText(
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        $('title').text() ||
        ''
      );

      // Bot-check pages and pages without a title are failures, never cached
      assertProductTitle(title, parsedUrl.hostname);

      const image =
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="image"]').attr('content') ||
        $('link[rel="image_src"]').attr('href') ||
        null;

      const price =
        $('meta[property="og:price:amount"]').attr('content') ||
        $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[name="price"]').attr('content') ||
        null;

      const description = sanitizeText(
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        ''
      );

      const parsedPrice = price ? parseFloat(price) : 0;
      const cleanDesc = description.substring(0, 300);

      const category = detectProductCategory(title, parsedUrl.hostname, cleanDesc);
      const suggestedVariables = getCategorySuggestedKeys(category);
      const initialProps = (existingCatalog?.properties as any) || {
        category,
        variables: suggestedVariables,
        popularOptions: {},
      };

      // Upsert into shared ProductCatalog database table
      let catalogRecord: any = null;
      try {
        catalogRecord = await db.productCatalog.upsert({
          where: { url: normalizedUrl },
          create: {
            url: normalizedUrl,
            title,
            price: parsedPrice,
            description: cleanDesc,
            thumbnailUrl: image,
            domain: parsedUrl.hostname,
            properties: initialProps,
          },
          update: {
            title,
            price: parsedPrice,
            description: cleanDesc,
            thumbnailUrl: image,
            domain: parsedUrl.hostname,
            scrapedAt: new Date(),
          },
        });
      } catch {
        // Upsert failed (DB unavailable), fallback to in-memory record
      }

      return NextResponse.json({
        success: true,
        foundInCatalog: false,
        metadata: {
          id: catalogRecord?.id || 'live-scraped',
          title: catalogRecord?.title || title,
          url: catalogRecord?.url || normalizedUrl,
          price: parsedPrice > 0 ? parsedPrice : undefined,
          description: cleanDesc || undefined,
          thumbnail: image || undefined,
          domain: parsedUrl.hostname,
          properties: catalogRecord?.properties || initialProps,
        },
      });
    } catch (error) {
      const failure = describeFetchFailure(error);
      await logScraperEvent(normalizedUrl, failure.action, failure.details).catch(() => {});

      // If we had a stale catalog record, fallback to it
      if (existingCatalog) {
        const category = (existingCatalog.properties as any)?.category || detectProductCategory(existingCatalog.title, existingCatalog.domain || parsedUrl.hostname, existingCatalog.description || '');
        const variables = (existingCatalog.properties as any)?.variables || getCategorySuggestedKeys(category);
        const properties = existingCatalog.properties || { category, variables, popularOptions: {} };

        return NextResponse.json({
          success: true,
          foundInCatalog: true,
          metadata: {
            id: existingCatalog.id,
            title: existingCatalog.title,
            url: existingCatalog.url,
            price: existingCatalog.price ? Number(existingCatalog.price) : undefined,
            description: existingCatalog.description || undefined,
            thumbnail: existingCatalog.thumbnailUrl || undefined,
            domain: existingCatalog.domain || parsedUrl.hostname,
            properties,
          },
        });
      }

      // Fast Failover: Return domain metadata so manual modal opens pre-filled
      const fallbackCategory = detectProductCategory(parsedUrl.hostname, parsedUrl.hostname);
      return NextResponse.json({
        success: false,
        fallback: true,
        metadata: {
          url: parsedUrl.toString(),
          domain: parsedUrl.hostname,
          properties: {
            category: fallbackCategory,
            variables: getCategorySuggestedKeys(fallbackCategory),
            popularOptions: {},
          },
        },
      });
    }
  } catch {
    return NextResponse.json({ error: 'Server error processing request' }, { status: 500 });
  }
}
