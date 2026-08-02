import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Valid product URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // 2.5 second AbortController timeout for fast failover
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

      // Extract Open Graph & Meta Metadata
      const title =
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        $('title').text().trim() ||
        parsedUrl.hostname;

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

      const description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';

      return NextResponse.json({
        success: true,
        data: {
          name: title,
          url: parsedUrl.toString(),
          price: price ? parseFloat(price) : null,
          description: description.substring(0, 300),
          thumbnailUrl: image,
          domain: parsedUrl.hostname,
        },
      });
    } catch {
      clearTimeout(timeoutId);
      // Fast Failover: Return domain metadata so manual modal opens pre-filled
      return NextResponse.json({
        success: false,
        fallback: true,
        data: {
          name: '',
          url: parsedUrl.toString(),
          domain: parsedUrl.hostname,
        },
      });
    }
  } catch {
    return NextResponse.json({ error: 'Server error processing request' }, { status: 500 });
  }
}
