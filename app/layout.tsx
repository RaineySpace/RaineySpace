import type { Metadata } from "next";
import "./globals.css";
import "./prose.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "My Blog",
  description: "A markdown-based blog built with Next.js",
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
              Rainey
            </span>
          </Link>
          <span className="relative top-1 italic">
            by{' '}
            <a 
              target="_blank" 
              href="#" 
              className="scale-100 active:scale-100"
              style={{opacity: 1, transition: 'transform 0.2s ease-in-out, opacity 0.2s 0.4s linear'}}
            >
              Me
            </a>
          </span>
        </header>
        <main>
        {children}
        </main>
      </body>
    </html>
  );
}
