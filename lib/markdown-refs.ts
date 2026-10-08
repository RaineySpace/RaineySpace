import { marked, type Token, type Tokens } from 'marked';
import { siteUrl } from './config.ts';
import { entityTypes, collectionEntities, type Entity, type EntityType } from './entities.ts';
import { collectionAliases, entityPath } from './content-paths.ts';
import { emptyCollectionMessage, renderEntityHtml, renderEntityInlineHtml, escapeEntityHtml } from './entity-rendering.ts';

export type EntityIndex = ReadonlyMap<string, Entity>;
export interface ResolvedLink {
  entity?: Entity;
  collection?: EntityType;
  expandable: boolean;
  href: string;
}

export function resolveEntityLink(href: string, entities: EntityIndex, sourceSlug?: string): ResolvedLink | null {
  let url: URL;
  try { url = new URL(href, new URL(sourceSlug ? entityPath(sourceSlug) : '/', siteUrl)); } catch { return null; }
  if (url.origin !== new URL(siteUrl).origin) return null;
  let pathname: string;
  try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
  const match = pathname.match(/^\/([^/]+?)(\.md|\/)?$/);
  if (!match) return null;
  const key = match[1];
  const expandable = !url.search && !url.hash && match[2] !== '.md';
  const entity = entities.get(key);
  if (entity) return { entity, expandable, href: `${url.pathname}${url.search}${url.hash}` };
  const type = key in collectionAliases ? collectionAliases[key as keyof typeof collectionAliases] : key;
  if (match[2] !== '.md' && entityTypes.includes(type as EntityType)) return {
    collection: type as EntityType, expandable, href: `/${type}/${url.search}${url.hash}`,
  };
  return null;
}

export function collectEntityLinks(content: string, entities: EntityIndex, slug: string): string[] {
  const targets = new Set<string>();
  walkContentLinks(marked.lexer(content), (token) => {
    const target = resolveEntityLink(token.href, entities, slug)?.entity;
    if (target && target.slug !== slug) targets.add(target.slug);
  });
  return [...targets];
}

export function walkContentLinks(tokens: Token[], visit: (link: Tokens.Link) => void) {
  const imageContents = new Set<Token>();
  marked.walkTokens(tokens, (token) => {
    if (imageContents.has(token)) return;
    if (token.type === 'image') {
      marked.walkTokens(token.tokens || [], (child) => { imageContents.add(child); });
    } else if (token.type === 'link') visit(token as Tokens.Link);
  });
}

function soleLink(token: Token): Tokens.Link | null {
  if (token.type !== 'paragraph') return null;
  const children = (token as Tokens.Paragraph).tokens.filter((child) => !(child.type === 'text' && !child.raw.trim()));
  if (children.length !== 1 || children[0].type !== 'link') return null;
  const link = children[0] as Tokens.Link;
  if (link.tokens.some((child) => child.type !== 'text' && child.type !== 'escape')) return null;
  return link;
}

export function transformEntityLinks(tokens: Token[], { entities, source, format = 'card' }: {
  entities: EntityIndex; source?: string; format?: 'card' | 'plain';
}) {
  // Only top-level paragraphs expand. Links inside headings, quotes or lists stay inline.
  for (let i = 0; i < tokens.length; i++) {
    const link = soleLink(tokens[i]);
    if (!link) continue;
    const resolved = resolveEntityLink(link.href, entities, source);
    if (!resolved?.expandable) continue;
    let html: string;
    if (resolved.collection) {
      const items = collectionEntities(entities.values(), resolved.collection);
      html = items.length ? (format === 'plain'
        ? `<ul>${items.map((item) => `<li><a href="${entityPath(item.slug)}">${escapeEntityHtml(item.title)}</a>${item.summary ? `：${escapeEntityHtml(item.summary)}` : ''}</li>`).join('')}</ul>`
        : `<div class="entity-card-list">${items.map((item) => renderEntityHtml(item)).join('')}</div>`)
        : `<p>${emptyCollectionMessage[resolved.collection]}</p>`;
    } else if (resolved.entity && format === 'card') {
      html = renderEntityHtml(resolved.entity);
    } else continue;
    tokens[i] = { type: 'html', raw: html, text: html, block: true, pre: false };
  }
  walkContentLinks(tokens, (link) => {
    const resolved = resolveEntityLink(link.href, entities, source);
    if (!resolved) return;
    link.href = resolved.href;
    let hasImage = false;
    marked.walkTokens(link.tokens, (child) => { if (child.type === 'image') hasImage = true; });
    // Image links must still reach the image renderer for optimization and anchors.
    if (hasImage) return;
    if (resolved.entity && format === 'card') {
      const html = renderEntityInlineHtml(resolved.entity, {}, { html: marked.Parser.parseInline(link.tokens), href: resolved.href });
      Object.assign(link, { type: 'html', raw: html, text: html, block: false, pre: false });
      delete (link as Partial<Tokens.Link>).tokens;
    }
  });
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\[\]<>*_`]/g, '\\$&').replace(/\s+/g, ' ');
}

export function expandedCollectionMarkdown(token: Token, entities: EntityIndex, source: string) {
  const link = soleLink(token);
  const resolved = link && resolveEntityLink(link.href, entities, source);
  if (!resolved?.collection || !resolved.expandable) return null;
  const items = collectionEntities(entities.values(), resolved.collection);
  return items.length ? items.map((item) => `- [${escapeMarkdown(item.title)}](${entityPath(item.slug)})${item.summary ? `：${escapeMarkdown(item.summary)}` : ''}`).join('\n') + '\n\n'
    : emptyCollectionMessage[resolved.collection] + '\n\n';
}
export function stripElementsByClass(html: string, className: string) {
  const openPattern = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\b${className}\\b[^>]*>`);
  let output = String(html);
  for (;;) {
    const match = output.match(openPattern);
    if (!match || match.index == null) break;
    const start = match.index;
    const tag = match[1];
    const openTag = `<${tag}`;
    const closeTag = `</${tag}>`;
    let depth = 0;
    let cursor = start;
    let end = -1;
    while (cursor < output.length) {
      const nextOpen = output.indexOf(openTag, cursor);
      const nextClose = output.indexOf(closeTag, cursor);
      if (nextClose === -1) break;
      const openIsTag = nextOpen !== -1 && nextOpen < nextClose && /<([a-zA-Z][\w-]*)\b/.exec(output.slice(nextOpen))?.[1] === tag;
      if (openIsTag) {
        depth += 1;
        cursor = nextOpen + openTag.length;
        continue;
      }
      depth -= 1;
      cursor = nextClose + closeTag.length;
      if (depth === 0) {
        end = cursor;
        break;
      }
    }
    if (end === -1) break;
    output = `${output.slice(0, start)}${output.slice(end)}`;
  }
  return output;
}
