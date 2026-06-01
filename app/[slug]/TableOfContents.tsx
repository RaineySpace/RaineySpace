"use client";

import { useEffect, useState } from "react";
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

  if (headings.length === 0) return null;

  return (
    <aside className="fixed left-[calc(50%+24rem)] top-28 hidden w-44 xl:block">
      <nav className="flex max-h-[calc(100vh-8rem)] flex-col gap-2 overflow-y-auto border-l border-gray-200 pl-4 text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
        {headings.map((heading) => {
          const isActive = heading.id === activeId;
          return (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              aria-current={isActive ? "true" : undefined}
              className={[
                "border-l-2 py-0.5 pl-2 transition-colors",
                heading.level === 3 ? "ml-3" : "",
                isActive
                  ? "border-[var(--color-primary)] font-medium text-gray-950 dark:text-white"
                  : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
              ].join(" ")}
            >
              {heading.text}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
