export interface ImageDownload {
  status: "idle" | "loading" | "ready" | "error";
  loaded: number;
  total?: number;
  objectUrl?: string;
  cached?: boolean;
}

export const IDLE_DOWNLOAD: ImageDownload = { status: "idle", loaded: 0 };

interface Entry {
  snapshot: ImageDownload;
  controller: AbortController;
  consumers: number;
  promise: Promise<boolean>;
}

/** Share the actual download between warmup and viewing; retain blobs only while in use. */
export class ImageDownloads {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  snapshot(src: string): ImageDownload { return this.entries.get(src)?.snapshot || IDLE_DOWNLOAD; }

  private notify() { this.listeners.forEach(listener => listener()); }

  acquire(src: string, priority: "high" | "low") {
    let entry = this.entries.get(src);
    if (!entry) {
      entry = { snapshot: { status: "loading", loaded: 0 }, controller: new AbortController(), consumers: 0, promise: Promise.resolve(false) };
      this.entries.set(src, entry);
      entry.promise = this.download(src, entry, priority);
      this.notify();
    }
    entry.consumers++;
    const retained = entry;
    let released = false;
    return {
      promise: entry.promise,
      release: () => {
        if (released) return;
        released = true;
        if (--retained.consumers !== 0) return;
        retained.controller.abort();
        if (retained.snapshot.objectUrl) URL.revokeObjectURL(retained.snapshot.objectUrl);
        if (this.entries.get(src) === retained) this.entries.delete(src);
        this.notify();
      },
    };
  }

  private async download(src: string, entry: Entry, priority: "high" | "low") {
    const started = performance.now();
    const current = () => this.entries.get(src) === entry && !entry.controller.signal.aborted;
    const update = (snapshot: ImageDownload) => {
      if (!current()) return;
      entry.snapshot = snapshot;
      this.notify();
    };
    try {
      const response = await fetch(src, { signal: entry.controller.signal, priority } as RequestInit & { priority: string });
      if (!response.ok) throw new Error(`Image response ${response.status}`);
      const length = Number(response.headers.get("Content-Length"));
      // Fetch exposes decoded bytes; a compressed Content-Length is not a valid denominator.
      const encoding = response.headers.get("Content-Encoding");
      let total = (!encoding || encoding === "identity") && Number.isSafeInteger(length) && length > 0 ? length : undefined;
      let loaded = 0;
      let lastUpdate = 0;
      update({ status: "loading", loaded, total });
      let blob: Blob;
      if (response.body) {
        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!current()) { await reader.cancel(); return false; }
            chunks.push(new Uint8Array(value));
            loaded += value.byteLength;
            if (total && loaded > total) total = undefined;
            const now = Date.now();
            if (now - lastUpdate >= 100 || loaded === total) {
              update({ status: "loading", loaded, total });
              lastUpdate = now;
            }
          }
        } finally { reader.releaseLock(); }
        blob = new Blob(chunks, { type: response.headers.get("Content-Type") || "application/octet-stream" });
      } else {
        blob = await response.blob();
      }
      if (!current()) return false;
      const timing = performance.getEntriesByName(src).at(-1) as PerformanceResourceTiming | undefined;
      update({ status: "ready", loaded: blob.size, total: blob.size, objectUrl: URL.createObjectURL(blob), cached: !!timing && timing.startTime >= started && timing.transferSize === 0 && timing.encodedBodySize > 0 });
      return true;
    } catch {
      update({ ...entry.snapshot, status: "error" });
      return false;
    }
  }
}

export function formatImageBytes(bytes: number, total = bytes) {
  if (total < 1000) return `${bytes}B`;
  if (total < 1000000) return `${(bytes / 1000).toFixed(1)}KB`;
  return `${(bytes / 1000000).toFixed(1)}MB`;
}
