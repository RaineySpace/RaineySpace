"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type NavigationEntry = { index: number; url: string | null };
type NavigationHistory = {
  currentEntry: NavigationEntry | null;
  entries: () => NavigationEntry[];
};

function pageUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

export default function BackButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();
  const pendingPage = useRef<string | null>(null);
  const remainingSteps = useRef(0);

  // Older browsers: continue through same-page hash entries after each popstate.
  useEffect(() => {
    const onPopState = () => {
      if (!pendingPage.current) return;
      if (pageUrl(window.location.href) !== pendingPage.current) {
        pendingPage.current = null;
      } else if (remainingSteps.current > 0) {
        remainingSteps.current -= 1;
        window.history.back();
      } else {
        pendingPage.current = null;
        router.replace("/");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  const goBack = () => {
    if (pendingPage.current) return;
    const currentPage = pageUrl(window.location.href);
    const navigation = (window as Window & { navigation?: NavigationHistory }).navigation;
    if (navigation?.currentEntry) {
      const currentIndex = navigation.currentEntry.index;
      const previousPage = navigation.entries().slice().reverse().find((entry) =>
        entry.index < currentIndex && entry.url && pageUrl(entry.url) !== currentPage
      );
      if (previousPage) {
        window.history.go(previousPage.index - currentIndex);
      } else {
        router.replace("/");
      }
      return;
    }

    if (window.history.length > 1) {
      pendingPage.current = currentPage;
      remainingSteps.current = window.history.length - 2;
      window.history.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <button
      type="button"
      aria-label="返回上一页"
      onClick={goBack}
      className={`inline-flex items-center justify-center rounded-lg text-sm text-(--muted) transition-colors duration-200 ease-in-out hover:bg-(--surface-muted) hover:text-(--title) focus-visible:bg-(--surface-muted) focus-visible:text-(--title) motion-reduce:transition-none ${iconOnly ? "h-8 w-8 shrink-0 p-0" : "gap-2 px-2 py-1"}`}
    >
      <span aria-hidden="true">←</span>
      {!iconOnly && <span>返回</span>}
    </button>
  );
}
