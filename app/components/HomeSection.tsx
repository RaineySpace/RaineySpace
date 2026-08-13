import Link from "next/link";
import type { ReactNode } from "react";

interface HomeSectionProps {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}

export default function HomeSection({
  id,
  title,
  href,
  linkLabel,
  children,
}: HomeSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-8">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="text-lg font-semibold tracking-tight text-[--title]">
          {title}
        </h2>
        {href && linkLabel && (
          <Link
            href={href}
            className="shrink-0 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            {linkLabel}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
