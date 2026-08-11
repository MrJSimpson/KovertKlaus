import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { isSafePublicUrl, sanitizeText, normalizeProductUrl } from '@/lib/security';

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
      return NextResponse.json({ error: ssrfCheck.error || 'Access to this URL is blocked for security reasons.' }, { status: 403 });
    }

    // Normalize URL to remove tracking parameters
    const normalizedUrl = normalizeProductUrl(formattedUrl);
    const parsedUrl = new URL(normalizedUrl);

    // Step 1: Check shared ProductCatalog in Database (~10ms fast hit)
    const existingCatalog = await db.productCatalog.findUnique({
      where: { url: normalizedUrl },
    });

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const isFresh = existingCatalog && (Date.now() - new Date(existingCatalog.scrapedAt).getTime() < TWENTY_FOUR_HOURS_MS);

    if (existingCatalog && isFresh) {
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
          properties: existingCatalog.properties || undefined,
        },
      });
    }

    // Step 2: 2.5 second AbortController timeout for fast failover scraping
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract & Sanitize Open Graph & Meta Metadata (Stored XSS Prevention)
      const title = sanitizeText(
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        $('title').text() ||
        parsedUrl.hostname
      );

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

      // Upsert into shared ProductCatalog database table
      const catalogRecord = await db.productCatalog.upsert({
        where: { url: normalizedUrl },
        create: {
          url: normalizedUrl,
          title,
          price: parsedPrice,
          description: cleanDesc,
          thumbnailUrl: image,
          domain: parsedUrl.hostname,
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

      return NextResponse.json({
        success: true,
        foundInCatalog: false,
        metadata: {
          id: catalogRecord.id,
          title: catalogRecord.title,
          url: catalogRecord.url,
          price: parsedPrice > 0 ? parsedPrice : undefined,
          description: cleanDesc || undefined,
          thumbnail: image || undefined,
          domain: parsedUrl.hostname,
        },
      });
    } catch {
      clearTimeout(timeoutId);
      
      // If we had a stale catalog record, fallback to it
      if (existingCatalog) {
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
          },
        });
      }

      // Fast Failover: Return domain metadata so manual modal opens pre-filled
      return NextResponse.json({
        success: false,
        fallback: true,
        metadata: {
          title: parsedUrl.hostname,
          url: parsedUrl.toString(),
          domain: parsedUrl.hostname,
        },
      });
    }
  } catch {
    return NextResponse.json({ error: 'Server error processing request' }, { status: 500 });
  }
}
