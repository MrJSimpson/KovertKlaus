import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { NOINDEX, SITE_NAME, publicPageMetadata, searchIndexingEnabled, siteUrl } from "@/lib/seo";

/*
 * Fonts of the visual refresh (owner decision 2026-10-30): Space Grotesk for headings, Inter for
 * text, IBM Plex Mono for codenames, stamps and IDs. All SIL Open Font License; next/font downloads
 * them at build time and serves them from this site, so no visitor request reaches Google.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/**
 * Site-wide metadata. `metadataBase` makes canonical and share-image links absolute. When search
 * indexing is off (self-hosted by default, `src/lib/seo.ts`) every page is marked noindex.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: SITE_NAME,
  ...publicPageMetadata("/"),
  alternates: undefined,
  ...(searchIndexingEnabled() ? {} : NOINDEX),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#041a2e" },
    { media: "(prefers-color-scheme: light)", color: "#34502b" },
  ],
};

import { ThemeProvider } from "@/context/ThemeContext";
import { FeedbackButton } from "@/components/FeedbackButton";
import { DEFAULT_THEME_SEASON, SEASON_STORAGE_KEY, THEME_SEASONS } from "@/lib/season";

/**
 * Applies the stored mode (`.dark`) and the last season seen (`data-season`) before React hydrates,
 * so neither flashes. Keys are shared with ThemeContext and `src/lib/season.ts`; only the four known
 * seasons are accepted, anything else keeps the winter default set on <html>.
 */
const THEME_BOOT_SCRIPT =
  `try{var d=document.documentElement;if(localStorage.getItem('kovertklaus_theme_mode')==='dark')d.classList.add('dark');` +
  `var s=localStorage.getItem('${SEASON_STORAGE_KEY}');if(${JSON.stringify(THEME_SEASONS)}.indexOf(s)>=0)d.dataset.season=s}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-season={DEFAULT_THEME_SEASON}
      className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved mode and season before first paint (no flash). Light winter is the default. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <FeedbackButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
