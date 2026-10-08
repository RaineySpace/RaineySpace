import { parseEntityMetadata } from '../lib/entity-metadata.ts';
import type { Post } from '../lib/posts.ts';

export function entity(slug = 'sample', overrides: Record<string, unknown> = {}) {
  return parseEntityMetadata(slug, { type: 'article', title: slug, summary: '简介', date: '2024-02-01', ...overrides });
}
export function post(slug = 'sample', overrides: Record<string, unknown> = {}): Post {
  return { ...entity(slug, overrides), showTitle: true, coverDisplaySrc: '', images: [], content: '', plainContent: '', headings: [], outgoing: [], incoming: [] };
}
