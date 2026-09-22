"use client";

import { useState } from "react";

export interface EntityCardItem {
  id: string;
  name: string;
  title?: string;
  url: string;
  description?: string;
  icon?: string;
}

interface EntityCardProps {
  item: EntityCardItem;
  headingLevel?: "h2" | "h3";
  visitLabel: string;
}

function getInitial(name: string): string {
  return Array.from(name.trim())[0] || "·";
}

export default function EntityCard({
  item,
  headingLevel = "h3",
  visitLabel,
}: EntityCardProps) {
  const Heading = headingLevel;
  const title = item.title ?? item.name;
  const [iconFailed, setIconFailed] = useState(false);
  const showIcon = Boolean(item.icon) && !iconFailed;

  return (
    <article data-hover-card className="entity-card">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`${visitLabel}：${title}`}
        className="entity-card-hit"
      />

      <div className="entity-card-body">
        <span className="entity-card-media" aria-hidden="true">
          {showIcon ? (
            // Registry icons may use any validated HTTPS host, so they cannot use a fixed Next Image allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.icon}
              alt=""
              loading="lazy"
              className="entity-card-icon"
              onError={() => setIconFailed(true)}
            />
          ) : (
            <span className="entity-card-fallback">{getInitial(title)}</span>
          )}
        </span>

        <div className="entity-card-copy">
          <Heading className="entity-card-name">{title}</Heading>
          {item.description ? <p className="entity-card-description">{item.description}</p> : null}
        </div>
      </div>
    </article>
  );
}
