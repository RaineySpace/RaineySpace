import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import * as config from "@/lib/config";

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
          <Link 
            href="/" 
            className="inline-block text-2xl font-black"
          >
            <span style={{
              backgroundImage: 'linear-gradient(45deg, var(--pink), var(--purple))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              transition: '--pink 0.2s ease-out, --myColor2 0.2s ease-in-out',
            }}>
              Rainey&apos;s Blog
            </span>
          </Link>
          <span className="relative top-1 italic">
            <Link href="/about">
              <Image src="/me.jpg" alt="Me" width={20} height={20} className="relative -top-1 mx-1 inline h-8 w-8 rounded-full" />
            </Link>
          </span>
        </header>
        <main>
        {children}
        </main>
      </body>
    </html>
  );
}
