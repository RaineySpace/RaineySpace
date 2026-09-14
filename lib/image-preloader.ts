export type PreloadPolicy = "all" | "neighbors" | "none";

export interface ImageConnection {
  saveData?: boolean;
  effectiveType?: string;
  type?: string;
}

export function imagePreloadPolicy(connection?: ImageConnection): PreloadPolicy {
  if (connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType || "")) return "none";
  if (connection?.type === "cellular" || connection?.effectiveType === "3g") return "neighbors";
  return "all";
}

interface PreloadTask {
  cancel: () => void;
  promote: () => void;
}

interface PreloaderOptions {
  load: (src: string, done: (success: boolean) => void) => PreloadTask;
  schedule: (run: () => void) => () => void;
}

/** One speculative request for the whole page; visible originals bypass the background queue. */
export class ImagePreloader {
  private groups = new Map<string, string[]>();
  private active: { id: string; index: number } | null = null;
  private foreground = new Map<symbol, { src: string; settled: boolean }>();
  private loaded = new Set<string>();
  private failed = new Set<string>();
  private listeners = new Set<() => void>();
  private environment = { pageLoaded: false, visible: true, online: true, policy: "all" as PreloadPolicy };
  private pending: ({ src: string } & PreloadTask) | null = null;
  private cancelScheduled: (() => void) | null = null;

  constructor(private options: PreloaderOptions) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  isLoaded(src: string) { return this.loaded.has(src); }

  register(id: string, sources: string[]) {
    this.groups.set(id, sources);
    this.pump();
    return () => {
      this.groups.delete(id);
      if (this.active?.id === id) this.active = null;
      const remaining = new Set(Array.from(this.groups.values()).flat());
      if (this.pending && !remaining.has(this.pending.src)) {
        const task = this.pending;
        this.pending = null;
        task.cancel();
      }
      // Keep only URL metadata for this page, never a gallery of decoded Image objects.
      for (const src of this.failed) if (!remaining.has(src)) this.failed.delete(src);
      for (const src of this.loaded) if (!remaining.has(src)) this.loaded.delete(src);
      this.notify();
      this.pump();
    };
  }

  activate(id: string, index: number | null) {
    if (index !== null && this.groups.get(id)?.[index]) this.active = { id, index };
    else if (this.active?.id === id) this.active = null;
    this.pump();
  }

  observeCurrent(src: string, settled: boolean) {
    const token = Symbol();
    this.foreground.set(token, { src, settled });
    // Reuse a warmup already in flight when the user opens that very image.
    if (this.pending?.src === src) this.pending.promote();
    this.pump();
    return () => {
      this.foreground.delete(token);
      this.pump();
    };
  }

  record(src: string, success: boolean) {
    if (success) {
      this.loaded.add(src);
      this.failed.delete(src);
    } else {
      this.loaded.delete(src);
      this.failed.add(src);
    }
    this.notify();
    this.pump();
  }

  updateEnvironment(environment: Partial<typeof this.environment>) {
    this.environment = { ...this.environment, ...environment };
    this.pump();
  }

  private notify() { this.listeners.forEach((listener) => listener()); }

  private nextSource(): string | undefined {
    const { visible, online, pageLoaded, policy } = this.environment;
    if (!visible || !online || policy === "none") return;
    if (Array.from(this.foreground.values()).some((image) => !image.settled)) return;

    const candidates: string[] = [];
    const sources = this.active && this.groups.get(this.active.id);
    const current = sources && this.active ? sources[this.active.index] : undefined;
    if (sources && this.active && sources.length > 1) {
      const { index } = this.active;
      candidates.push(sources[(index + 1) % sources.length], sources[(index - 1 + sources.length) % sources.length]);
      if (policy === "all" && pageLoaded) {
        // Continue forwards through the opened group before warming other groups.
        for (let offset = 2; offset < sources.length - 1; offset++) {
          candidates.push(sources[(index + offset) % sources.length]);
        }
      }
    }
    if (policy === "all" && pageLoaded) this.groups.forEach((group) => candidates.push(...group));
    return candidates.find((src) => src && src !== current && !this.loaded.has(src) && !this.failed.has(src)
      && !Array.from(this.foreground.values()).some((image) => image.src === src));
  }

  private pump() {
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    if (this.pending || !this.nextSource()) return;
    this.cancelScheduled = this.options.schedule(() => {
      this.cancelScheduled = null;
      const src = this.nextSource();
      if (!src) return;
      // Set the identity before loading, so late events from canceled tasks are ignored.
      const task = { src, cancel: () => {}, promote: () => {} };
      this.pending = task;
      Object.assign(task, this.options.load(src, (success) => {
        if (this.pending !== task) return;
        this.pending = null;
        this.record(src, success);
      }));
    });
  }
}
