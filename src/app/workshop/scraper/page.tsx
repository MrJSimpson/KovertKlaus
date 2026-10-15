'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';

interface ScrapedMetadata {
  id?: string;
  title: string;
  url: string;
  price?: number;
  description?: string;
  thumbnail?: string;
  domain?: string;
  properties?: Record<string, unknown>;
}

interface ScrapeResult {
  success?: boolean;
  foundInCatalog?: boolean;
  fallback?: boolean;
  error?: string;
  metadata?: ScrapedMetadata;
}

export default function WorkshopScraperBench() {
  const { theme, isDarkMode } = useTheme();

  const [testUrl, setTestUrl] = useState<string>('https://www.lego.com');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [requestTimeMs, setRequestTimeMs] = useState<number | null>(null);
  const [lastTestedUrl, setLastTestedUrl] = useState<string>('');

  // 3 Preset Categories
  const ecommercePresets = [
    { label: 'LEGO Official Store', url: 'https://www.lego.com' },
    { label: 'Target Product Item', url: 'https://www.target.com/p/apple-airpods/-/A-12345' },
    { label: 'Amazon Product (with UTM & Ref tags)', url: 'https://www.amazon.com/dp/B08N5WRWNW/?ref_=ast_sto_dp&tag=affil-20&utm_source=facebook&fbclid=IwAR2' },
    { label: 'GitHub Classified Repository', url: 'https://github.com/JoshuaSimpson341/kovertklaus' },
  ];

  const ssrfAttackPresets = [
    { label: 'Loopback Postgres Port (OWASP SSRF)', url: 'http://127.0.0.1:5432' },
    { label: 'AWS Cloud Metadata Endpoint (SSRF)', url: 'http://169.254.169.254/latest/meta-data/' },
    { label: 'Integer Encoded IP (2130706433 = 127.0.0.1)', url: 'http://2130706433/' },
    { label: 'DNS Rebinding Wildcard (nip.io)', url: 'http://127.0.0.1.nip.io' },
    { label: 'Embedded Userinfo Credentials', url: 'http://admin:secretPass123@example.com' },
  ];

  const failoverPresets = [
    { label: 'Non-Existent DNS Domain (Fast-Failover)', url: 'https://thisdomainshouldnotexist12345.org' },
    { label: 'Blackhole IP (2.5s AbortController Timeout)', url: 'http://10.255.255.1:8080' },
  ];

  const handleTestScrape = async (targetUrl: string) => {
    setLoading(true);
    setResult(null);
    setRequestTimeMs(null);
    setLastTestedUrl(targetUrl);

    const startTime = Date.now();

    try {
      const response = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const elapsed = Date.now() - startTime;
      setRequestTimeMs(elapsed);

      const data: ScrapeResult = await response.json();
      setResult(data);
    } catch {
      const elapsed = Date.now() - startTime;
      setRequestTimeMs(elapsed);
      setResult({ error: 'Network error calling /api/scraper endpoint' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-kk-border">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-kk-primary animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-kk-inset/80 text-kk-accent border border-kk-border-strong">
              WORKSHOP LAB // OPENGRAPH METADATA SCRAPER
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-kk-heading flex items-center gap-2">
            <span>OpenGraph Scraper & Fast-Failover Bench</span>
          </h1>
          <p className="text-kk-muted text-xs font-mono mt-1">
            Test OpenGraph URL metadata scraping, OWASP A01 SSRF security defenses, tracking parameter stripping, and 2.5s fast-failovers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workshop/draw"
            className="bg-kk-success hover:brightness-95 text-kk-on-success border border-kk-on-success/30 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🎯 Draw & Swap
          </Link>
          <Link
            href="/workshop/lifecycle"
            className="bg-kk-warning hover:brightness-95 text-kk-on-warning border border-kk-border-strong px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            ⏰ Schedule
          </Link>
          <Link
            href="/workshop"
            className="bg-kk-surface hover:border-kk-border-strong text-kk-ink px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            ← Workshop Hub
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: URL Input & Presets */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* URL Input Form */}
          <div className="p-6 rounded-2xl border bg-kk-surface border-kk-border-strong shadow-xl">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-kk-accent mb-2 flex items-center gap-2">
              <span>🔎 TARGET PRODUCT URL SCRAPER</span>
            </h2>
            <p className="text-xs text-kk-muted mb-4 font-mono">
              Enter any public product URL or click a pre-configured scenario below.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTestScrape(testUrl);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-mono text-kk-ink mb-1 font-bold">PRODUCT URL:</label>
                <input
                  type="url"
                  required
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://www.lego.com/..."
                  className="w-full bg-kk-inset border border-kk-border-strong rounded-lg px-3 py-2 text-xs text-kk-ink font-mono focus:outline-none focus:border-kk-focus"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-kk-primary hover:bg-kk-primary-hover disabled:bg-kk-surface text-kk-on-primary font-black py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-black/20 font-mono text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-kk-inset animate-ping inline-block"></span>
                    <span>SCRAPING URL (2.5s CAP)...</span>
                  </>
                ) : (
                  <span>🚀 TEST SCRAPE ENDPOINT</span>
                )}
              </button>
            </form>

            {/* Presets Accordion */}
            <div className="mt-6 pt-4 border-t border-kk-border space-y-4 font-mono text-xs">
              
              {/* 1. E-Commerce Presets */}
              <div>
                <span className="text-[11px] text-kk-accent font-bold block mb-2">🛒 E-COMMERCE PRODUCTS:</span>
                <div className="space-y-1.5">
                  {ecommercePresets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTestUrl(preset.url);
                        handleTestScrape(preset.url);
                      }}
                      className="w-full text-left bg-kk-inset hover:bg-kk-surface p-2 rounded-lg border border-kk-border text-[11px] transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-kk-ink truncate">{preset.label}</span>
                      <span className="text-kk-accent font-bold ml-2">➔</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. SSRF Attack Presets */}
              <div>
                <span className="text-[11px] text-kk-danger font-bold block mb-2">🛡️ OWASP A01 SSRF EXPLOIT TESTS:</span>
                <div className="space-y-1.5">
                  {ssrfAttackPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTestUrl(preset.url);
                        handleTestScrape(preset.url);
                      }}
                      className="w-full text-left bg-kk-danger-soft hover:brightness-95 p-2 rounded-lg border border-kk-danger/40 text-[11px] transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-kk-danger truncate">{preset.label}</span>
                      <span className="text-kk-danger font-bold ml-2">Block ➔</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Timeout & Failover Presets */}
              <div>
                <span className="text-[11px] text-kk-gold-ink font-bold block mb-2">⏱️ 2.5s TIMEOUT & FAILOVER:</span>
                <div className="space-y-1.5">
                  {failoverPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTestUrl(preset.url);
                        handleTestScrape(preset.url);
                      }}
                      className="w-full text-left bg-kk-warning hover:brightness-95 p-2 rounded-lg border border-kk-border-strong text-[11px] transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-kk-gold-ink truncate">{preset.label}</span>
                      <span className="text-kk-gold-ink font-bold ml-2">Test ➔</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Performance Specs Card */}
          <div className="p-6 rounded-2xl border bg-kk-surface border-kk-border text-xs font-mono space-y-3">
            <h3 className="font-bold text-kk-ink uppercase tracking-wider">⚡ SCRAPER ARCHITECTURE INVARIANTS</h3>
            <div className="space-y-2 text-kk-muted">
              <div className="flex justify-between border-b border-kk-border pb-1">
                <span>Tier 1 DB Cache:</span>
                <span className="text-kk-brand font-bold">~10ms</span>
              </div>
              <div className="flex justify-between border-b border-kk-border pb-1">
                <span>Tier 2 AbortController:</span>
                <span className="text-kk-gold-ink font-bold">2.5s Max Cap</span>
              </div>
              <div className="flex justify-between border-b border-kk-border pb-1">
                <span>Tier 3 Fast-Failover:</span>
                <span className="text-kk-accent font-bold">Manual Pre-Fill</span>
              </div>
              <div className="flex justify-between border-b border-kk-border pb-1">
                <span>SSRF Defense:</span>
                <span className="text-kk-danger font-bold">OWASP A01</span>
              </div>
              <div className="flex justify-between">
                <span>Tracking Normalizer:</span>
                <span className="text-kk-gold-ink font-bold">utm/ref/tag Stripped</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Results Output */}
        <div className="lg:col-span-2 space-y-6">

          {/* Results Header Card */}
          <div className="p-6 rounded-2xl border bg-kk-surface border-kk-border-strong">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-kk-border pb-3">
              <h2 className="text-base font-mono font-bold text-kk-heading flex items-center gap-2">
                <span>🖥️ SCRAPER RESPONSE TELEMETRY</span>
              </h2>
              {requestTimeMs !== null && (
                <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                  requestTimeMs < 100 ? 'bg-kk-success text-kk-on-success border-kk-on-success/30' :
                  requestTimeMs < 2600 ? 'bg-kk-inset text-kk-accent border-kk-border-strong' :
                  'bg-kk-warning text-kk-on-warning border-kk-border-strong'
                }`}>
                  RESPONSE TIME: {requestTimeMs}ms
                </span>
              )}
            </div>

            {!result && !loading && (
              <div className="text-xs font-mono text-kk-muted py-16 text-center border border-dashed border-kk-border rounded-xl">
                Enter a product URL or select a test scenario on the left to inspect scraper telemetry.
              </div>
            )}

            {loading && (
              <div className="text-xs font-mono text-kk-accent py-16 text-center border border-kk-border-strong rounded-xl bg-kk-inset animate-pulse space-y-2">
                <div className="font-bold text-sm">⏳ FETCHING OPENGRAPH METADATA...</div>
                <div className="text-kk-muted">AbortController 2.5s timeout active | SSRF validator engaged</div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                
                {/* Result Status Banner */}
                {result.error && (
                  <div className="bg-kk-danger-soft border-2 border-kk-danger/40 text-kk-on-danger-soft p-4 rounded-xl text-xs font-mono font-bold space-y-1">
                    <div className="text-kk-danger uppercase tracking-wide">🚫 BLOCKED (OWASP A01 SSRF DEFENSE)</div>
                    <div>{result.error}</div>
                  </div>
                )}

                {result.success && result.foundInCatalog && (
                  <div className="bg-kk-success border-2 border-kk-on-success/30 text-kk-on-success p-3.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between">
                    <span>✓ FAST PRODUCTCATALOG DB CACHE HIT (~10ms)</span>
                    <span className="bg-kk-success px-2 py-0.5 rounded text-[10px]">CACHE FRESH (&lt;24H)</span>
                  </div>
                )}

                {result.success && !result.foundInCatalog && (
                  <div className="bg-kk-inset/80 border-2 border-kk-border-strong text-kk-accent p-3.5 rounded-xl text-xs font-mono font-bold">
                    ✓ LIVE OPENGRAPH METADATA SCRAPED & CACHED IN DB
                  </div>
                )}

                {result.fallback && (
                  <div className="bg-kk-warning border-2 border-kk-border-strong text-kk-on-warning p-3.5 rounded-xl text-xs font-mono font-bold space-y-1">
                    <div className="uppercase tracking-wide">⚠️ TIER 3 FAST-FAILOVER ACTIVATED</div>
                    <div className="text-kk-gold-ink font-normal">
                      Target server blocked scraper or timed out after 2.5s. System gracefully fell over to pre-filled manual entry modal.
                    </div>
                  </div>
                )}

                {/* Parsed Product Card Preview */}
                {result.metadata && (
                  <div className="bg-kk-inset p-5 rounded-xl border border-kk-border space-y-3">
                    <div className="text-xs font-mono text-kk-muted uppercase tracking-widest flex items-center justify-between">
                      <span>PARSED ITEM PREVIEW</span>
                      <span className="text-kk-accent">DOMAIN: {result.metadata.domain || 'N/A'}</span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 pt-1">
                      {result.metadata.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={result.metadata.thumbnail}
                          alt="Product Thumbnail"
                          className="w-24 h-24 object-cover rounded-lg border border-kk-border bg-kk-surface shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-lg border border-kk-border bg-kk-surface flex items-center justify-center text-kk-muted font-mono text-xs shrink-0">
                          No Image
                        </div>
                      )}
                      
                      <div className="space-y-1.5 flex-1 font-sans">
                        <h3 className="text-base font-bold text-kk-heading">{result.metadata.title}</h3>
                        
                        {result.metadata.price !== undefined && result.metadata.price > 0 && (
                          <div className="text-base font-black text-kk-gold-ink font-mono">
                            ${result.metadata.price.toFixed(2)}
                          </div>
                        )}

                        {result.metadata.description && (
                          <p className="text-xs text-kk-muted line-clamp-2">{result.metadata.description}</p>
                        )}

                        <div className="text-[11px] font-mono text-kk-muted truncate pt-1">
                          URL: {result.metadata.url}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw JSON Debug Output */}
                <div className="bg-kk-inset p-4 rounded-xl border border-kk-border font-mono text-[11px] space-y-2">
                  <div className="text-kk-muted text-[10px] uppercase">RAW API RESPONSE JSON</div>
                  <pre className="text-kk-accent overflow-x-auto p-3 bg-kk-surface/60 rounded-lg border border-kk-border">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
