'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ScrapedMetadata {
  id?: string;
  title: string;
  url: string;
  price?: number;
  description?: string;
  thumbnail?: string;
  domain?: string;
}

export default function ScraperTestHarness() {
  const [testUrl, setTestUrl] = useState<string>('https://www.lego.com');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{
    success?: boolean;
    foundInCatalog?: boolean;
    fallback?: boolean;
    error?: string;
    metadata?: ScrapedMetadata;
  } | null>(null);
  const [requestTimeMs, setRequestTimeMs] = useState<number | null>(null);

  // Quick URL Presets for Testing
  const presetUrls = [
    { label: 'LEGO Official', url: 'https://www.lego.com' },
    { label: 'GitHub Repository', url: 'https://github.com/MrJSimpson/KovertKlaus' },
    { label: 'Blocked Internal IP (SSRF Test)', url: 'http://127.0.0.1:5432' },
    { label: 'AWS Metadata (SSRF Test)', url: 'http://169.254.169.254/latest/meta-data/' },
    { label: 'Invalid Domain', url: 'https://thisdomainshouldnotexist12345.org' },
  ];

  const handleTestScrape = async (targetUrl: string) => {
    setLoading(true);
    setResult(null);
    setRequestTimeMs(null);

    const startTime = Date.now();

    try {
      const response = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const elapsed = Date.now() - startTime;
      setRequestTimeMs(elapsed);

      const data = await response.json();
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
    <div className="min-h-screen pb-16 px-4 sm:px-8 max-w-7xl mx-auto bg-slate-950 text-slate-100">
      {/* HUD Header */}
      <header className="py-8 border-b border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-sky-400 animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-sky-950/80 text-sky-300 border border-sky-500/30">
              TEST HARNESS // METADATA SCRAPER BENCH
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2 flex items-center gap-3">
            <span>KOVERT KLAUS</span>
            <span className="text-sky-400 font-mono text-sm border border-sky-500/30 px-2 py-1 rounded bg-sky-950/40">
              OPENGRAPH SCRAPER BENCH
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Test OpenGraph URL metadata scraping, SSRF security validation, and 2.5s fast-failover fallbacks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/tests"
            className="bg-gray-900 hover:bg-gray-800 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg font-mono text-xs transition-colors"
          >
            ← Return to Test Lab
          </Link>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        
        {/* Left Column: URL Input & Presets */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="p-6 rounded-xl border-2 bg-slate-900 border-sky-500/40">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-sky-400 mb-3">
              🔎 URL SCRAPER CONTROLLER
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Enter any public e-commerce product URL or select a security test preset below.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTestScrape(testUrl);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1 font-bold">TARGET PRODUCT URL:</label>
                <input
                  type="url"
                  required
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://example.com/product/123"
                  className="w-full bg-slate-950 border border-sky-500/40 rounded-lg px-3 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-950 font-black py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-sky-950/60 font-mono text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-slate-950 animate-ping inline-block"></span>
                    <span>SCRAPING URL (2.5s MAX)...</span>
                  </>
                ) : (
                  <span>🚀 TEST SCRAPE ENDPOINT</span>
                )}
              </button>
            </form>

            {/* Test Presets */}
            <div className="mt-6 pt-4 border-t border-gray-800 space-y-2">
              <span className="text-[11px] font-mono text-gray-400 block">TEST PRESETS (SSRF & TIMEOUTS):</span>
              <div className="flex flex-col gap-2">
                {presetUrls.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTestUrl(preset.url);
                      handleTestScrape(preset.url);
                    }}
                    className="text-left bg-slate-950 hover:bg-slate-800 p-2.5 rounded-lg border border-slate-800 text-xs font-mono transition-colors flex items-center justify-between"
                  >
                    <span className="text-sky-300 font-bold">{preset.label}</span>
                    <span className="text-[10px] text-gray-500">Run ➔</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scraper Performance Specs */}
          <div className="p-6 rounded-xl border-2 bg-slate-900 border-slate-800 text-xs font-mono space-y-3">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider">⚡ PERFORMANCE INVARIANTS</h3>
            <div className="space-y-2 text-gray-400">
              <div className="flex justify-between border-b border-gray-800 pb-1">
                <span>Catalog DB Cache:</span>
                <span className="text-emerald-400 font-bold">~10ms</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-1">
                <span>AbortController Timeout:</span>
                <span className="text-amber-400 font-bold">2.5 Seconds</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-1">
                <span>SSRF Validation:</span>
                <span className="text-sky-300 font-bold">OWASP A01 Enforced</span>
              </div>
              <div className="flex justify-between">
                <span>XSS Sanitization:</span>
                <span className="text-purple-300 font-bold">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Results Output */}
        <div className="lg:col-span-2 space-y-6">

          {/* Scrape Results Terminal */}
          <div className="p-6 rounded-xl border-2 bg-slate-900 border-sky-500/30">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
              <h2 className="text-base font-mono font-bold text-white flex items-center gap-2">
                <span>🖥️ SCRAPER RESPONSE PAYLOAD</span>
              </h2>
              {requestTimeMs !== null && (
                <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                  requestTimeMs < 100 ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' :
                  requestTimeMs < 2600 ? 'bg-sky-950 text-sky-300 border-sky-500/40' :
                  'bg-amber-950 text-amber-300 border-amber-500/40'
                }`}>
                  RESPONSE TIME: {requestTimeMs}ms
                </span>
              )}
            </div>

            {!result && !loading && (
              <div className="text-xs font-mono text-gray-500 py-12 text-center border border-dashed border-gray-800 rounded-lg">
                Enter a product URL or click a test preset above to test the OpenGraph scraper endpoint.
              </div>
            )}

            {loading && (
              <div className="text-xs font-mono text-sky-400 py-12 text-center border border-sky-500/30 rounded-lg bg-sky-950/20 animate-pulse">
                ⏳ FETCHING OPENGRAPH METADATA FROM URL... (2.5s TIMEOUT CAP ACTIVE)
              </div>
            )}

            {result && (
              <div className="space-y-4">
                
                {/* Result Status Banner */}
                {result.error && (
                  <div className="bg-red-950/80 border-2 border-red-800 text-red-200 p-4 rounded-xl text-xs font-mono font-bold">
                    🚫 SSRF / ACCESS ERROR: {result.error}
                  </div>
                )}

                {result.success && result.foundInCatalog && (
                  <div className="bg-emerald-950/80 border-2 border-emerald-800 text-emerald-300 p-3 rounded-xl text-xs font-mono font-bold flex items-center justify-between">
                    <span>✓ FAST DB CATALOG CACHE HIT (~10ms)</span>
                    <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[10px]">CACHE FRESH (24H)</span>
                  </div>
                )}

                {result.success && !result.foundInCatalog && (
                  <div className="bg-sky-950/80 border-2 border-sky-800 text-sky-300 p-3 rounded-xl text-xs font-mono font-bold">
                    ✓ LIVE OPENGRAPH METADATA SCRAPED SUCCESSFULLY
                  </div>
                )}

                {result.fallback && (
                  <div className="bg-amber-950/80 border-2 border-amber-800 text-amber-300 p-3 rounded-xl text-xs font-mono font-bold">
                    ⚠️ FAST FAILOVER ACTIVATED: Website blocked scraper or timed out after 2.5s. Opening manual entry modal with pre-filled domain.
                  </div>
                )}

                {/* Parsed Product Card Preview */}
                {result.metadata && (
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">PARSED ITEM PREVIEW</div>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                      {result.metadata.thumbnail && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={result.metadata.thumbnail}
                          alt="Product Thumbnail"
                          className="w-24 h-24 object-cover rounded-lg border border-slate-800 bg-slate-900"
                        />
                      )}
                      
                      <div className="space-y-1.5 flex-1 font-sans">
                        <h3 className="text-base font-bold text-white">{result.metadata.title}</h3>
                        
                        {result.metadata.price && (
                          <div className="text-sm font-black text-amber-400 font-mono">
                            ${result.metadata.price.toFixed(2)}
                          </div>
                        )}

                        {result.metadata.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">{result.metadata.description}</p>
                        )}

                        <div className="text-[11px] font-mono text-sky-400 pt-1">
                          DOMAIN: {result.metadata.domain || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw JSON Debug Output */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] space-y-2">
                  <div className="text-slate-400 text-[10px] uppercase">RAW API RESPONSE JSON</div>
                  <pre className="text-sky-300 overflow-x-auto p-2 bg-slate-900/60 rounded border border-slate-800">
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
