import fs from "fs/promises";
import path from "node:path";

export const OPTIMIZED_DIR = "_optimized";
export const SKIP_PUBLIC_DIRS = new Set(["assets", OPTIMIZED_DIR]);
export const RASTER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export interface DisplayImage {
  displaySrc: string;
  thumbnailSrc?: string;
  srcSet?: string;
  width?: number;
  height?: number;
}

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
    return manifestCache.data[originalSrc] || { displaySrc: originalSrc };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { displaySrc: originalSrc };
  }
}
