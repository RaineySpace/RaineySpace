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
          <Link href={href} aria-label={linkLabel || title} className="section-heading-row">
            <h2 id={headingId} className="section-title section-heading-title">
              {title}<span aria-hidden="true" className="section-heading-arrow">↗</span>
            </h2>
            {description && <p className="section-heading-description">{description}</p>}
          </Link>
        ) : (
          <div className="section-heading-row">
            <h2 id={headingId} className="section-title section-heading-title">{title}</h2>
            {description && <p className="section-heading-description">{description}</p>}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}
