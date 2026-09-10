"use client";

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PostTagCount } from "@/lib/posts";
import { READING_SETTINGS_CHANGE_EVENT } from "@/lib/reading-settings";

interface ArticleListProps {
  posts: { slug: string; tags: string[]; card: ReactNode }[];
  tagCounts: PostTagCount[];
}

interface ArticleListContentProps extends ArticleListProps {
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
}

function tagButtonClassName(active: boolean) {
  return `inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--lightLink] dark:focus-visible:outline-[--darkLink] ${
    active
      ? "border-[--title] bg-[--surface-muted] font-medium text-[--title]"
      : "border-transparent bg-[--surface-muted] text-[--secondary] hover:border-[--border]"
  }`;
}

function ToggleTagsIcon({ expanded = false }: { expanded?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ArticleTagFilter({
  tagCounts,
  selectedTag,
  onSelectTag,
}: Pick<ArticleListContentProps, "tagCounts" | "selectedTag" | "onSelectTag">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measurement = measurementRef.current;
    if (!container || !measurement) return;
    let disposed = false;

    const measure = () => {
      if (disposed) return;
      const widths = Array.from(measurement.children, (child) => child.getBoundingClientRect().width);
      const moreWidth = widths.pop() || 0;
      const gap = parseFloat(getComputedStyle(measurement).columnGap) || 0;
      const availableWidth = container.clientWidth;
      const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);

      if (totalWidth <= availableWidth) {
        setVisibleCount(widths.length);
        return;
      }

      let usedWidth = moreWidth;
      let count = 0;
      for (const width of widths) {
        if (usedWidth + gap + width > availableWidth) break;
        usedWidth += gap + width;
        count += 1;
      }
      setVisibleCount(count);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    void document.fonts.ready.then(measure);
    window.addEventListener(READING_SETTINGS_CHANGE_EVENT, measure);
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener(READING_SETTINGS_CHANGE_EVENT, measure);
    };
  }, [tagCounts, selectedTag]);

  const visibleTags = expanded || visibleCount === null ? tagCounts : tagCounts.slice(0, visibleCount);
  const showMore = !expanded && visibleCount !== null && visibleCount < tagCounts.length;

  if (!tagCounts.length) return null;

  return (
    <div ref={containerRef} role="group" aria-label="按标签筛选文章" className="article-tag-filter relative mb-8">
      <div
        ref={measurementRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex gap-2 overflow-hidden"
      >
        {tagCounts.map(({ tag, count }) => (
          <span key={tag} className={tagButtonClassName(selectedTag === tag)}>
            <span>{tag}</span>
            <span className="text-xs tabular-nums opacity-70">{count}</span>
          </span>
        ))}
        <span className={tagButtonClassName(false)}><ToggleTagsIcon /></span>
      </div>
      <div className={`flex gap-2 ${expanded ? "flex-wrap" : visibleCount === null ? "h-7 overflow-hidden" : "min-h-7"}`}>
        {visibleTags.map(({ tag, count }) => (
          <button
            key={tag}
            type="button"
            aria-pressed={selectedTag === tag}
            disabled={!onSelectTag}
            onClick={() => onSelectTag?.(selectedTag === tag ? null : tag)}
            className={`${tagButtonClassName(selectedTag === tag)} max-w-full`}
          >
            <span className="min-w-0 truncate">{tag}</span>
            <span className="shrink-0 text-xs tabular-nums opacity-70">{count}</span>
          </button>
        ))}
        {(showMore || expanded) && (
          <button
            type="button"
            aria-label={expanded ? "收起标签" : "展开所有标签"}
            title={expanded ? "收起标签" : "展开所有标签"}
            aria-expanded={expanded}
            disabled={!onSelectTag}
            onClick={() => {
              const firstHiddenIndex = visibleCount ?? 0;
              setExpanded(!expanded);
              requestAnimationFrame(() => {
                const container = containerRef.current;
                const focusTarget = expanded
                  ? container?.querySelector<HTMLButtonElement>("button[aria-expanded]") ?? container?.querySelector("button")
                  : container?.querySelectorAll("button")[firstHiddenIndex];
                focusTarget?.focus({ preventScroll: true });
              });
            }}
            className={tagButtonClassName(false)}
          >
            <ToggleTagsIcon expanded={expanded} />
          </button>
        )}
      </div>
    </div>
  );
}

export function ArticleListContent({
  posts,
  tagCounts,
  selectedTag = null,
  onSelectTag,
}: ArticleListContentProps) {
  const visiblePosts = selectedTag === null
    ? posts
    : posts.filter((post) => post.tags.includes(selectedTag));

  return (
    <div>
      <ArticleTagFilter tagCounts={tagCounts} selectedTag={selectedTag} onSelectTag={onSelectTag} />
      <div className="flex flex-col gap-8">
        {visiblePosts.map((post) => (
          <Fragment key={post.slug}>{post.card}</Fragment>
        ))}
      </div>
    </div>
  );
}

export default function ArticleList({ posts, tagCounts }: ArticleListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTag = searchParams.get("tag");
  const selectedTag = tagCounts.some(({ tag }) => tag === requestedTag) ? requestedTag : null;

  function selectTag(tag: string | null) {
    if (tag === selectedTag) return;

    const params = new URLSearchParams(searchParams.toString());
    if (tag === null) {
      params.delete("tag");
    } else {
      params.set("tag", tag);
    }

    const query = params.toString();
    const href = `${pathname}${query ? `?${query}` : ""}`;
    router.push(href, { scroll: false });
  }

  return (
    <ArticleListContent
      posts={posts}
      tagCounts={tagCounts}
      selectedTag={selectedTag}
      onSelectTag={selectTag}
    />
  );
}
