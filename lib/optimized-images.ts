import fs from "fs/promises";
import path from "node:path";

export const OPTIMIZED_DIR = "_optimized";
export const SKIP_PUBLIC_DIRS = new Set(["assets", OPTIMIZED_DIR]);
export const RASTER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export interface DisplayImage {
  originalSrc?: string;
  displaySrc: string;
  thumbnailSrc?: string;
  srcSet?: string;
  width?: number;
  height?: number;
}

export interface OptimizedImage extends DisplayImage {
  originalSrc: string;
  width: number;
  height: number;
  sourceHash: string;
  pipelineHash: string;
}
export type ImageManifest = Record<string, OptimizedImage>;

export function toOriginalSrc(slug: string, relativePath: string): string {
  return `/${[slug, ...relativePath.split('/')].map(encodeURIComponent).join('/')}`;
}

export function isRasterImagePath(relativePath: string): boolean {
  return RASTER_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

let manifestCache: { filename: string; mtimeMs: number; data: Record<string, DisplayImage> } | undefined;

export async function resolveDisplayImage(slug: string, relativePath: string): Promise<DisplayImage> {
  const originalSrc = toOriginalSrc(slug, relativePath);
  if (!isRasterImagePath(relativePath)) return { displaySrc: originalSrc };
  const filename = path.join(process.cwd(), 'public', OPTIMIZED_DIR, 'manifest.json');
  try {
    const { mtimeMs } = await fs.stat(filename);
    if (manifestCache?.filename !== filename || manifestCache.mtimeMs !== mtimeMs) {
      manifestCache = { filename, mtimeMs, data: JSON.parse(await fs.readFile(filename, 'utf8')) };
    }
    const entry = manifestCache.data[originalSrc];
    if (!entry) return { displaySrc: originalSrc };
    // Build-cache fingerprints stay in the manifest, not in page props.
    return {
      originalSrc: entry.originalSrc,
      displaySrc: entry.displaySrc,
      thumbnailSrc: entry.thumbnailSrc,
      srcSet: entry.srcSet,
      width: entry.width,
      height: entry.height,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { displaySrc: originalSrc };
  }
}
