import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import * as config from "@/lib/config";
import { SENIOR_MODE_BOOTSTRAP_SCRIPT } from "@/lib/senior-mode";
import SiteHeader from "./components/SiteHeader";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: config.title,
  authors: [{ name: config.author, url: config.siteUrl }],
  creator: config.author,
  description: config.description,
  keywords: config.keywords,
  icons: {
    icon: config.icon,
  },
  openGraph: {
    title: config.title,
    description: config.description,
    images: config.avatar,
    url: config.siteUrl,
    siteName: config.title,
    locale: "zh-CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: config.author,
    creator: config.author,
    images: config.avatar,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="mx-auto max-w-2xl bg-[--bg] px-5 py-8 sm:py-12 text-[--text]">
        <Script id="senior-mode" strategy="beforeInteractive">
          {SENIOR_MODE_BOOTSTRAP_SCRIPT}
        </Script>
        <SiteHeader />
        <main>
        {children}
        </main>
      </body>
    </html>
  );
}
