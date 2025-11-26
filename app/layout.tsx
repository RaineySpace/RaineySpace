import type { Metadata } from "next";
import "./globals.css";
import * as config from "@/lib/config";
import HomeLink from "./components/HomeLink";
import AboutLink from "./components/AboutLink";

export const metadata: Metadata = {
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
    <html lang="en">
      <body className="mx-auto max-w-2xl bg-[--bg] px-5 py-12 text-[--text]">
        <header className="mb-14 flex flex-row place-content-between">
          <HomeLink />
          <AboutLink/>
        </header>
        <main>
        {children}
        </main>
      </body>
    </html>
  );
}
