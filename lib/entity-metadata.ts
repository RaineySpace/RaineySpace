import { entityTypes, type Entity, type EntityType } from './entities.ts';
import { normalizeRelativeAssetPath, reservedSlugs, resolvePublicAsset } from './content-paths.ts';
import { parsePostOptions } from './post-options.ts';
import { parseUpdatedDate } from './post-dates.ts';
import { siteUrl } from './config.ts';

const sharedFields = new Set(['type', 'title', 'name', 'summary', 'date', 'updated', 'tags', 'keywords', 'icon', 'cover', 'location', 'url', 'redirect', 'noindex', 'showHeader']);
function text(data: Record<string, unknown>, field: string, required = false) {
  const value = data[field];
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || !value.trim()) throw new Error(`frontmatter "${field}" must be a non-empty string`);
  return value.trim();
}
function boolean(data: Record<string, unknown>, field: string) {
  if (data[field] === undefined) return false;
  if (typeof data[field] !== 'boolean') throw new Error(`frontmatter "${field}" must be a boolean`);
  return data[field];
}
function list(data: Record<string, unknown>, field: string): string[] {
  const value = data[field];
  if (value === undefined) return [];
  const values = typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(values) || values.some((item) => typeof item !== 'string')) throw new Error(`frontmatter "${field}" must be a string array or comma-separated string`);
  return [...new Set(values.map((item: string) => item.trim()).filter(Boolean))];
}
function httpUrl(value: string, httpsOnly = false) {
  try {
    if (/\s/.test(value)) return false;
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === 'https:' || (!httpsOnly && url.protocol === 'http:'));
  } catch { return false; }
}
function mailtoUrl(value: string) {
  try {
    if (/\s/.test(value)) return false;
    const url = new URL(value);
    return url.protocol === 'mailto:' && !url.host && !url.hash &&
      /^[^\s@<>()\[\],;:"\\/?#]+@[^\s@<>()\[\],;:"\\/?#]+$/u.test(decodeURIComponent(url.pathname));
  } catch { return false; }
}
function dateValue(value: unknown, frontmatter: string): Date | null {
  if (value === undefined) return null;
  const raw = value instanceof Date
    ? frontmatter.match(/^[ \t]*(?:date|'date'|"date")[ \t]*:[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*(?:#.*)?$/m)?.[1]
    : typeof value === 'string' ? value.trim() : '';
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error('frontmatter "date" must be a valid YYYY-MM-DD date');
  return date;
}

export function parseEntityMetadata(slug: string, data: Record<string, unknown>, frontmatter = ''): Entity {
  if (!slug || slug !== slug.trim() || /[/\\\u0000-\u001f]/.test(slug) || slug.startsWith('.') || reservedSlugs.has(slug.toLowerCase())) throw new Error(`${slug}: invalid or reserved slug`);
  try {
    const type = data.type as EntityType;
    if (!entityTypes.includes(type)) throw new Error('frontmatter "type" must be article, project, friend or contact');
    for (const key of Object.keys(data)) {
      if (!sharedFields.has(key) && !(type === 'article' && (key === 'hidden' || key === 'pinned'))) throw new Error(`unknown frontmatter "${key}" for ${type}`);
    }
    const title = text(data, 'title', true);
    const hidden = type === 'article' && boolean(data, 'hidden');
    const date = dateValue(data.date, frontmatter);
    const summary = text(data, 'summary', type === 'article' && !hidden);
    if (type === 'article' && !hidden && !date) throw new Error('public article requires "date"');
    const icon = text(data, 'icon');
    if (icon && !httpUrl(icon, true) && !resolvePublicAsset(icon, '/public')) throw new Error('"icon" must be an HTTPS URL or site-absolute public path');
    const cover = text(data, 'cover');
    if (cover && !httpUrl(cover) && !resolvePublicAsset(cover, '/public') && !normalizeRelativeAssetPath(cover)) throw new Error('invalid "cover" path or URL');
    const url = text(data, 'url', type === 'contact');
    if (url && !httpUrl(url) && !(type === 'contact' && mailtoUrl(url))) throw new Error('invalid "url"; use HTTP(S), or mailto for contact');
    const redirect = boolean(data, 'redirect');
    if (redirect && !httpUrl(url)) throw new Error('"redirect" requires an HTTP(S) "url"');
    if (redirect) {
      const target = new URL(url);
      if (target.origin === new URL(siteUrl).origin && decodeURIComponent(target.pathname).replace(/\/$/, '') === `/${slug}`) throw new Error('"redirect" cannot point to itself');
    }
    const base = {
      slug, title, name: text(data, 'name') || title, summary, date, dateText: date?.toISOString().slice(0, 10) || '',
      updated: parseUpdatedDate(data.updated, date, frontmatter), tags: list(data, 'tags'), keywords: list(data, 'keywords'),
      icon, cover, location: text(data, 'location'), url, redirect, ...parsePostOptions(data),
    };
    return type === 'article' ? { ...base, type, hidden, pinned: boolean(data, 'pinned') } : { ...base, type };
  } catch (error) { throw new Error(`${slug}: ${(error as Error).message}`); }
}
