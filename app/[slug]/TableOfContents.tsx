"use client";

import { useEffect, useState } from "react";
import BackButton from "@/app/components/BackButton";
import ReadingSettings from "@/app/components/ReadingSettings";
import type { Heading } from "@/lib/posts";

interface TableOfContentsProps {
  headings: Heading[];
}

const activeOffset = 160;

function getHashId() {
  if (typeof window === "undefined") return "";
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

function getActiveHeadingId(headings: Heading[]) {
  let activeId = headings[0]?.id || "";

  for (const heading of headings) {
    const element = document.getElementById(heading.id);
    if (!element) continue;
    if (element.getBoundingClientRect().top <= activeOffset) {
      activeId = heading.id;
    } else {
      break;
    }
  }

  return activeId;
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id || "");

  useEffect(() => {
    if (headings.length === 0) return;

    const hashId = getHashId();
    if (hashId && headings.some((heading) => heading.id === hashId)) {
      setActiveId(hashId);
    } else {
      setActiveId(getActiveHeadingId(headings));
    }

    let frame = 0;
    const updateActiveId = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextActiveId = getActiveHeadingId(headings);
        setActiveId(nextActiveId);
      });
    };

    const observer = new IntersectionObserver(updateActiveId, {
      rootMargin: `-${activeOffset}px 0px -70% 0px`,
      threshold: [0, 1],
    });

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    }

    window.addEventListener("scroll", updateActiveId, { passive: true });
    window.addEventListener("hashchange", updateActiveId);
    window.addEventListener("resize", updateActiveId);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", updateActiveId);
      window.removeEventListener("hashchange", updateActiveId);
      window.removeEventListener("resize", updateActiveId);
    };
  }, [headings]);

  return (
    <aside className="fixed right-[calc(50%+24rem)] top-12 hidden w-44 xl:block">
      <div className="mb-6 flex items-center justify-between gap-2">
        <BackButton />
        <ReadingSettings align="start" />
      </div>
      {headings.length > 0 && (
      <nav className="flex max-h-[calc(100dvh-10rem)] flex-col gap-2 overflow-y-auto text-xs leading-relaxed text-[--muted]">
        {headings.map((heading) => {
          const isActive = heading.id === activeId;
          return (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              aria-current={isActive ? "true" : undefined}
              className={[
                "py-0.5 transition-colors",
                heading.level === 3 ? "ml-3" : "",
                isActive
                  ? "font-medium text-[--title]"
                  : "text-[--muted] hover:text-[--title]",
              ].join(" ")}
            >
              {heading.text}
            </a>
          );
        })}
      </nav>
      )}
    </aside>
  );
}
