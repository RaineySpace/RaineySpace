import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { Entity } from './entities.ts';
import { parseEntityMetadata } from './entity-metadata.ts';
import { collectEntityLinks } from './markdown-refs.ts';
import { siteUrl } from './config.ts';
import { entityAssetSrc } from './content-paths.ts';
import type { ImageManifest } from './optimized-images.ts';

export interface SourceDocument { entity: Entity; content: string; source: string }
export interface ContentIndex {
  documents: Map<string, SourceDocument>;
  entities: Map<string, Entity>;
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
}

/** Read metadata first; rendering never participates in discovery or reference extraction. */
export function loadContentIndex(root = process.cwd()): ContentIndex {
  const publicDir = path.join(root, 'public');
  const manifestPath = path.join(publicDir, '_optimized/manifest.json');
  const images: ImageManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const documents = new Map<string, SourceDocument>();
  const entities = new Map<string, Entity>();
  const normalized = new Set<string>();
  for (const entry of fs.readdirSync(publicDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const filename = path.join(publicDir, entry.name, 'index.md');
    if (!fs.existsSync(filename)) continue;
    const slug = entry.name;
    if (normalized.has(slug.toLowerCase())) throw new Error(`${slug}: duplicate slug (case-insensitive)`);
    normalized.add(slug.toLowerCase());
    const source = fs.readFileSync(filename, 'utf8');
    // gray-matter's default cache drops the non-enumerable raw matter field.
    // Preserve it on every read so YAML calendar-date validation stays reliable.
    const parsed = matter(source, {});
    const entity = parseEntityMetadata(slug, parsed.data, parsed.matter);
    const cover = images[entityAssetSrc(slug, entity.cover)];
    if (cover) {
      const { originalSrc, displaySrc, thumbnailSrc, srcSet, width, height } = cover;
      entity.coverImage = { originalSrc, displaySrc, thumbnailSrc, srcSet, width, height };
    }
    documents.set(slug, { entity, content: parsed.content, source });
    entities.set(slug, entity);
  }
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const [slug, { content }] of documents) {
    const targets = collectEntityLinks(content, entities, slug);
    outgoing.set(slug, targets);
    for (const target of targets) incoming.set(target, [...incoming.get(target) || [], slug]);
  }
  // An HTTP target can be local; reject redirect cycles without affecting normal citation cycles.
  for (const entity of entities.values()) {
    let current: Entity | undefined = entity;
    const seen = new Set<string>();
    while (current?.redirect) {
      if (seen.has(current.slug)) throw new Error(`${entity.slug}: redirect cycle`);
      seen.add(current.slug);
      const url: URL = new URL(current.url);
      current = url.origin === new URL(siteUrl).origin
        ? entities.get(decodeURIComponent(url.pathname).replace(/^\//, '').replace(/\/$/, '')) : undefined;
    }
  }
  return { documents, entities, outgoing, incoming };
}
