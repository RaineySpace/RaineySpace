import fs from "node:fs/promises";
import path from "node:path";

export function postMarkdownName(slug) {
  return `${slug}.md`;
}

export function postMarkdownPath(publicDir, slug) {
  return path.join(publicDir, postMarkdownName(slug));
}

export function postAssetDir(publicDir, slug) {
  return path.join(publicDir, slug);
}

export async function listPostSlugs(publicDir) {
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -3));
}
