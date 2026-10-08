import { entityTypes } from './entities.ts';

export const collectionAliases = {
  articles: 'article', projects: 'project', friends: 'friend', contacts: 'contact',
} as const;
export const reservedSlugs = new Set<string>([
  ...entityTypes, ...Object.keys(collectionAliases), 'assets', '_optimized', '_next',
  'photography', 'feed', 'llms.txt', 'robots.txt', 'sitemap.xml', 'rss.xml', 'atom.xml', '404',
]);

export function entityPath(slug: string) {
  return `/${encodeURIComponent(slug)}/`;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function normalizeRelativeAssetPath(value: unknown): string | null {
  const href = String(value).trim().split(/[?#]/, 1)[0];
  if (!href || href.startsWith('/') || href.includes('\\') || /^[a-z][a-z\d+.-]*:/i.test(href)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(href); } catch { return null; }
  if (decoded.startsWith('/') || decoded.includes('\\') || decoded.split('/').includes('..')) return null;
  const normalized = decoded.split('/').filter((segment) => segment && segment !== '.').join('/');
  return normalized && normalized !== '.' && !normalized.startsWith('/') ? normalized : null;
}

export function resolvePublicAsset(value: string, publicDir: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  const relative = normalizeRelativeAssetPath(value.slice(1));
  return relative ? `${publicDir.replace(/\/$/, '')}/${relative}` : null;
}

/** Resolve document-relative media against its owner, not the referring page. */
export function entityAssetSrc(slug: string, value: string) {
  const relative = normalizeRelativeAssetPath(value);
  return relative ? `${entityPath(slug)}${relative.split('/').map(encodeURIComponent).join('/')}` : value;
}

export function imageAnchor(relativePath: string) {
  // A reversible, stable identifier independent of image optimization or body order.
  return `photo-${encodeURIComponent(relativePath)}`;
}
