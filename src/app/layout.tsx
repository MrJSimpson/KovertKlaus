import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KovertKlaus | Simple & Fun Secret Santa & Gift Exchanges",
  description: "Organize Secret Santa, Yankee Swaps, and Holiday Gift Exchanges in 60 seconds with universal wishlists and guaranteed 1-to-1 fair matching.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e4d82" },
    { media: "(prefers-color-scheme: light)", color: "#34502b" },
  ],
};

import { ThemeProvider } from "@/context/ThemeContext";
import { FeedbackButton } from "@/components/FeedbackButton";

/** Reads the stored theme choice (key shared with ThemeContext) and sets `.dark` before React hydrates. */
const THEME_BOOT_SCRIPT =
  "try{if(localStorage.getItem('kovertklaus_theme_mode')==='dark')document.documentElement.classList.add('dark')}catch(e){}";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a saved dark-mode choice before first paint (no light flash). Light is the default. */}
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
