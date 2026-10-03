"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const NavigationContext = createContext<(action: () => void) => void>((action) => action());

export function usePageTransition() {
  return useContext(NavigationContext);
}

const clearFrame = { opacity: 0 };
const blurredFrame = { opacity: 1 };
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pagePath = (path: string) => path.replace(/\/+$/, "") || "/";

export default function PageTransition({ header, children }: { header: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const pending = useRef(false);
  const recovery = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPath = useRef(pathname);

  const reset = useCallback(() => {
    animation.current?.cancel();
    animation.current = null;
    pending.current = false;
    if (recovery.current !== null) clearTimeout(recovery.current);
    recovery.current = null;
    document.documentElement.removeAttribute("data-page-transition");
    if (container.current) container.current.inert = false;
    if (main.current) {
      main.current.removeAttribute("aria-busy");
    }
  }, []);

  const navigate = useCallback((action: () => void) => {
    if (pending.current) return;
    const element = overlay.current;
    const opacity = element ? getComputedStyle(element).opacity : "0";
    reset();
    if (!element || reduceMotion() || typeof element.animate !== "function") {
      action();
      return;
    }

    pending.current = true;
    document.documentElement.setAttribute("data-page-transition", "out");
    if (container.current) container.current.inert = true;
    if (main.current) {
      main.current.setAttribute("aria-busy", "true");
    }
    // A failed or same-route navigation must never leave the overlay visible.
    recovery.current = setTimeout(reset, 8000);
    const exit = element.animate([{ opacity }, blurredFrame], {
      duration: 240,
      easing: "cubic-bezier(0.4, 0, 1, 1)",
      fill: "forwards",
    });
    animation.current = exit;
    void exit.finished.then(() => {
      if (animation.current !== exit) return;
      document.documentElement.setAttribute("data-page-transition", "waiting");
      action();
    }).catch(() => {
      // Canceled animations may belong to an earlier navigation.
      if (animation.current === exit) reset();
    });
  }, [reset]);

  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    reset();
    // The old page was inert during the swap; restore keyboard focus on the
    // committed page without disturbing Next's scroll/hash restoration.
    main.current?.focus({ preventScroll: true });
    const element = overlay.current;
    if (!element || reduceMotion() || typeof element.animate !== "function") return;

    // Keep the viewport blurred until the new route commits, then reveal it.
    // This runs before paint so the overlay stays visible across the swap.
    // Native back/forward also takes this path without delaying browser history.
    document.documentElement.setAttribute("data-page-transition", "in");
    const entrance = element.animate([blurredFrame, clearFrame], {
      duration: 700,
      easing: "ease-out",
    });
    animation.current = entrance;
    void entrance.finished.then(() => {
      if (animation.current === entrance) reset();
    }).catch(() => {});
  }, [pathname, reset]);

  useLayoutEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let historyFrame = 0;
    const onMotionChange = () => {
      // Finish an outgoing animation so its navigation still runs.
      if (motion.matches) animation.current?.finish();
    };
    const onPageShow = () => reset();
    const onPopState = () => {
      // BackButton can return to another query on the same pathname. Such a
      // traversal has no pathname commit to release the outgoing animation.
      cancelAnimationFrame(historyFrame);
      historyFrame = requestAnimationFrame(() => {
        if (pending.current && pagePath(window.location.pathname) === pagePath(previousPath.current)) reset();
      });
    };
    motion.addEventListener("change", onMotionChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    return () => {
      cancelAnimationFrame(historyFrame);
      motion.removeEventListener("change", onMotionChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
      reset();
    };
  }, [reset]);

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self") || link.relList.contains("external") || link.hasAttribute("data-no-page-transition")) return;
    const url = new URL(link.href, window.location.href);
    const current = new URL(window.location.href);
    // Keep hash links, query filters, feeds, files, and external navigation native.
    if (url.origin !== current.origin || pagePath(url.pathname) === pagePath(current.pathname) || /\.[^/]+\/?$/.test(url.pathname) || pagePath(url.pathname) === "/feed") return;
    event.preventDefault();
    navigate(() => router.push(url.pathname + url.search + url.hash));
  };

  return (
    <NavigationContext.Provider value={navigate}>
      <div ref={container} onClickCapture={onClick}>
        {header}
        <main ref={main} tabIndex={-1}>{children}</main>
      </div>
      <div ref={overlay} className="page-transition-overlay" aria-hidden="true" />
    </NavigationContext.Provider>
  );
}
