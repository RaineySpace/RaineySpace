import fs from "node:fs/promises";
import path from "node:path";

export const SKIP_PUBLIC_DIRS = new Set(["assets", "_optimized"]);

export function postMarkdownName(slug) {
  return path.posix.join(slug, "index.md");
}

export function postMarkdownPath(publicDir, slug) {
  return path.join(publicDir, slug, "index.md");
}

export function postAssetDir(publicDir, slug) {
  return path.join(publicDir, slug);
}

export function publishedMarkdownName(slug) {
  return `${slug}.md`;
}

export async function listPostSlugs(publicDir) {
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const slugs = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_PUBLIC_DIRS.has(entry.name)) continue;
    try {
      await fs.access(postMarkdownPath(publicDir, entry.name));
      slugs.push(entry.name);
    } catch {
      // Asset-only directories are not posts.
    }
  }

  return slugs;
}
