import Link from "next/link";
import type { ReactNode } from "react";

interface HomeSectionProps {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
  description?: string;
  children: ReactNode;
}

export default function HomeSection({
  id,
  title,
  href,
  linkLabel,
  description,
  children,
}: HomeSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-8">
      <header className="mb-4">
        {href ? (
          <Link href={href} aria-label={linkLabel || title} className="group/section flex min-w-0 items-baseline gap-4">
            <h2 id={headingId} className="section-title shrink-0 border-b border-(--border) pb-0.5 transition-[border-color] duration-200 ease-[ease] group-hover/section:border-(--title) group-focus-visible/section:border-(--title)">
              {title}<span aria-hidden="true" className="inline-block pl-1 transition-transform duration-200 ease-[ease] group-hover/section:translate-x-[0.1em] group-hover/section:-translate-y-[0.1em] group-focus-visible/section:translate-x-[0.1em] group-focus-visible/section:-translate-y-[0.1em] motion-reduce:translate-none! motion-reduce:transition-none">↗</span>
            </h2>
            {description && <p className="m-0 min-w-0 text-xs leading-[1.75] text-(--secondary)">{description}</p>}
          </Link>
        ) : (
          <div className="flex min-w-0 items-baseline gap-4">
            <h2 id={headingId} className="section-title shrink-0">{title}</h2>
            {description && <p className="m-0 min-w-0 text-xs leading-[1.75] text-(--secondary)">{description}</p>}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}
