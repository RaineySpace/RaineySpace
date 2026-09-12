import type { Metadata, Viewport } from "next";
import "./globals.css";
import * as config from "@/lib/config";
import { READING_SETTINGS_BOOTSTRAP_SCRIPT } from "@/lib/reading-settings";
import SiteHeader from "./components/SiteHeader";
import { pageMetadata, pages } from "@/lib/seo";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  ...pageMetadata(pages.home),
  metadataBase: new URL(config.siteUrl),
  authors: [{ name: config.author, url: config.authorUrl }],
  creator: config.author,
  keywords: config.keywords,
  icons: {
    icon: config.icon,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: READING_SETTINGS_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="mx-auto max-w-2xl bg-[--bg] px-5 py-8 sm:py-12 text-[--text]">
        <SiteHeader />
        <main>
        {children}
        </main>
      </body>
    </html>
  );
}
