import fs from "fs/promises";
import path from "node:path";

export const OPTIMIZED_DIR = "_optimized";
export const SKIP_PUBLIC_DIRS = new Set(["assets", OPTIMIZED_DIR]);
export const RASTER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export function toOptimizedSrc(slug: string, relativePath: string): string {
  const parsed = path.posix.parse(relativePath);
  const optimizedRelative = path.posix.join(parsed.dir, `${parsed.name}.webp`);
  return `/${OPTIMIZED_DIR}/${slug}/${optimizedRelative}`;
}

export function toOriginalSrc(slug: string, relativePath: string): string {
  return `/${slug}/${relativePath}`;
}

export function isRasterImagePath(relativePath: string): boolean {
  return RASTER_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

export async function resolveDisplaySrc(slug: string, relativePath: string): Promise<string> {
  const originalSrc = toOriginalSrc(slug, relativePath);
  if (!isRasterImagePath(relativePath)) return originalSrc;

  const optimizedSrc = toOptimizedSrc(slug, relativePath);
  const optimizedPath = path.join(process.cwd(), "public", optimizedSrc.slice(1));

  try {
    await fs.access(optimizedPath);
    return optimizedSrc;
  } catch {
    return originalSrc;
  }
}
