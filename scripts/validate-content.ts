import fs from 'node:fs/promises';
import path from 'node:path';
import { marked, type Tokens } from 'marked';
import exifr from 'exifr';
import { loadContentIndex } from '../lib/content-index.ts';
import { normalizeRelativeAssetPath, resolvePublicAsset, reservedSlugs } from '../lib/content-paths.ts';
import { resolveEntityLink, walkContentLinks } from '../lib/markdown-refs.ts';
import { siteUrl } from '../lib/config.ts';

const publicDir = path.join(process.cwd(), 'public');
const exifExtensions = new Set(['.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.heic']);

function assetStem(relativePath: string) {
  const parsed = path.posix.parse(relativePath);
  return path.posix.join(parsed.dir, parsed.name).replace(/^\//, "");
}

async function collectMovFiles(dir: string, base = ""): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      files.push(...(await collectMovFiles(path.join(dir, entry.name), path.posix.join(base, entry.name))));
      continue;
    }
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".mov") {
      files.push(base ? path.posix.join(base, entry.name) : entry.name);
    }
  }

  return files;
}

async function exists(filePath: string) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function hasCaptureTime(filePath: string) {
  try {
    const parsed = await exifr.parse(filePath, {
      pick: ["DateTimeOriginal", "CreateDate"],
      reviveValues: true,
    });
    return Boolean(parsed?.DateTimeOriginal || parsed?.CreateDate);
  } catch {
    return false;
  }
}

async function main() {
  const index = loadContentIndex();
  const errors: string[] = [], warnings: string[] = [];
  let photoCount = 0;
  for (const [slug, { entity, content }] of index.documents) {
    const postDir = path.join(publicDir, slug);
    if (entity.icon.startsWith('/')) {
      const asset = resolvePublicAsset(entity.icon, publicDir);
      if (!asset || !await exists(asset)) errors.push(`${slug}: missing icon asset ${entity.icon}`);
    }
    if (entity.cover && !/^https?:/.test(entity.cover)) {
      const asset = entity.cover.startsWith('/') ? resolvePublicAsset(entity.cover, publicDir) : path.join(postDir, normalizeRelativeAssetPath(entity.cover)!);
      if (!asset || !await exists(asset)) warnings.push(`${slug}: missing cover asset ${entity.cover}`);
    }
    const images: Tokens.Image[] = [];
    const links: Tokens.Link[] = [];
    const tokens = marked.lexer(content);
    marked.walkTokens(tokens, (token) => {
      if (token.type === 'image') images.push(token as Tokens.Image);
    });
    walkContentLinks(tokens, (link) => { links.push(link); });
    const selected = new Set<string>(), imageStems = new Set<string>();
    for (const image of images) {
      const photography = image.title === 'photography';
      const relative = normalizeRelativeAssetPath(image.href);
      if (!relative) {
        if (photography) errors.push(`${slug}: photography image must stay inside its post directory: ${image.href}`);
        continue;
      }
      if (photography && !image.text.trim()) errors.push(`${slug}: photography image must have non-empty alt text: ${image.href}`);
      imageStems.add(assetStem(relative));
      const filename = path.join(postDir, relative);
      if (!await exists(filename)) {
        (photography ? errors : warnings).push(`${slug}: missing image asset ${image.href}`);
        continue;
      }
      if (photography && !selected.has(relative)) {
        selected.add(relative);
        if (exifExtensions.has(path.extname(relative).toLowerCase()) && !await hasCaptureTime(filename)) warnings.push(`${slug}: photography image is missing EXIF capture time: ${image.href}`);
      }
    }
    photoCount += selected.size;
    for (const mov of await collectMovFiles(postDir)) {
      if (!imageStems.has(assetStem(mov))) warnings.push(`${slug}: Live Photo video has no matching Markdown image: ${mov}`);
    }
    for (const link of links) {
      if (resolveEntityLink(link.href, index.entities, slug)) continue;
      let url: URL;
      try { url = new URL(link.href, `${siteUrl}/${encodeURIComponent(slug)}/`); } catch { continue; }
      if (url.origin !== new URL(siteUrl).origin) continue;
      const pathname = decodeURIComponent(url.pathname);
      const key = pathname.replace(/^\//, '').replace(/\/$/, '');
      if (!key || reservedSlugs.has(key)) continue;
      // Files and nested asset paths keep their own validation; only document-shaped links are entities.
      if (/^[^/.]+(?:\.md)?$/.test(key) && !index.entities.has(key.replace(/\.md$/, ''))) errors.push(`${slug}: unknown document link ${link.href}`);
    }
  }
  warnings.forEach((warning) => console.warn(`WARN ${warning}`));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Content validation passed for ${index.documents.size} entities and ${photoCount} photography images with ${warnings.length} warning(s).`);
}
main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
