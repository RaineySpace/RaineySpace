"use client";

import { useEffect, useId, useLayoutEffect, useSyncExternalStore } from "react";
import { ImagePreloader, imagePreloadPolicy, type ImageConnection } from "@/lib/image-preloader";
import { ImageDownloads, IDLE_DOWNLOAD } from "@/lib/image-downloads";

const downloads = new ImageDownloads();

function supportsProgress(src: string) {
  if (typeof window === "undefined" || !src) return false;
  try {
    const url = new URL(src, document.baseURI);
    return url.origin === location.origin && /^https?:$/.test(url.protocol);
  } catch { return false; }
}

export function useOriginalDownload(src: string, enabled: boolean, active: boolean) {
  const normalized = typeof window === "undefined" ? src : normalizeSource(src);
  const tracked = supportsProgress(src);
  const snapshot = useSyncExternalStore(downloads.subscribe, () => enabled && tracked ? downloads.snapshot(normalized) : IDLE_DOWNLOAD, () => IDLE_DOWNLOAD);
  useLayoutEffect(() => {
    if (!enabled || !tracked) return;
    const handle = downloads.acquire(normalized, active ? "high" : "low");
    return handle.release;
    // A role change keeps an in-flight request rather than restarting its download.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, enabled, tracked]);
  return { ...snapshot, imageSrc: enabled ? (tracked ? snapshot.objectUrl || null : src) : null };
}

function normalizeSource(src: string) {
  if (!src) return src;
  try { return new URL(src, document.baseURI).href; }
  catch { return src; }
}

function scheduleIdle(run: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 500);
  return () => window.clearTimeout(id);
}

const preloader = new ImagePreloader({
  schedule: scheduleIdle,
  load: (src, done) => {
    if (supportsProgress(src)) {
      const handle = downloads.acquire(src, "low");
      let cancelled = false;
      void handle.promise.then(success => {
        if (!cancelled) done(success);
        handle.release();
      });
      return {
        cancel: () => { cancelled = true; handle.release(); },
        // Fetch priority cannot be changed after dispatch. The active viewer shares its bytes.
        promote: () => {},
      };
    }
    const image = new Image();
    let cancelled = false;
    const clear = () => { image.onload = null; image.onerror = null; };
    const finish = (success: boolean) => {
      clear();
      if (!cancelled) done(success);
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = src;
    return {
      cancel: () => { cancelled = true; clear(); image.removeAttribute("src"); },
      promote: () => { image.fetchPriority = "high"; },
    };
  },
});

let registrations = 0;
let stopObserving: (() => void) | undefined;

function observeEnvironment() {
  const connection = (navigator as Navigator & { connection?: ImageConnection & EventTarget }).connection;
  const update = () => preloader.updateEnvironment({
    pageLoaded: document.readyState === "complete",
    visible: document.visibilityState !== "hidden",
    online: navigator.onLine,
    policy: imagePreloadPolicy(connection),
  });
  window.addEventListener("load", update);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  document.addEventListener("visibilitychange", update);
  connection?.addEventListener("change", update);
  update();
  return () => {
    window.removeEventListener("load", update);
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
    document.removeEventListener("visibilitychange", update);
    connection?.removeEventListener("change", update);
  };
}

/** All lightboxes register here, including closed covers, article images and galleries. */
export function useImagePreloading(images: { src: string }[], activeIndex: number | null) {
  const id = useId();
  // Callers may pass inline arrays. Register only when the actual source list changes.
  const sourcesKey = JSON.stringify(images.map((image) => image.src));
  useEffect(() => {
    if (registrations++ === 0) stopObserving = observeEnvironment();
    const unregister = preloader.register(id, (JSON.parse(sourcesKey) as string[]).map(normalizeSource));
    return () => {
      unregister();
      if (--registrations === 0) { stopObserving?.(); stopObserving = undefined; }
    };
  }, [id, sourcesKey]);
  useEffect(() => {
    preloader.activate(id, activeIndex);
    return () => preloader.activate(id, null);
  }, [id, sourcesKey, activeIndex]);
}

export function usePreloadedImage(src: string) {
  return useSyncExternalStore(preloader.subscribe, () => preloader.isLoaded(normalizeSource(src)), () => false);
}

export function useCurrentImageLoading(src: string, active: boolean, ready: boolean, error: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    return preloader.observeCurrent(normalizeSource(src), ready || error);
  }, [src, active, ready, error]);
  useEffect(() => {
    if (ready || error) preloader.record(normalizeSource(src), ready);
  }, [src, ready, error]);
}
