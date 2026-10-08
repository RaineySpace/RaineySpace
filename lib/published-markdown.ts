import matter from 'gray-matter';
import { marked, type Token, type Tokens } from 'marked';
import { normalizeRelativeAssetPath } from './content-paths.ts';
import { loadContentIndex } from './content-index.ts';
import { expandedCollectionMarkdown, resolveEntityLink, type EntityIndex } from './markdown-refs.ts';

export { normalizeRelativeAssetPath } from './content-paths.ts';

export function toSiteAbsoluteAssetPath(href: string, slug: string) {
  const relativePath = normalizeRelativeAssetPath(href);
  if (!relativePath) return null;
  const suffix = href.match(/[?#].*$/)?.[0] || '';
  return `/${[slug, ...relativePath.split('/')].map(encodeURIComponent).join('/')}${suffix}`;
}

/** Rewrite actual Markdown tokens only; code examples and prose are left intact. */
export function rewritePublishedMarkdown(source: string, slug: string, entities: EntityIndex = loadContentIndex().entities) {
  const { data, content } = matter(source);
  let prefix = source.slice(0, source.length - content.length);
  if (typeof data.cover === 'string') {
    const next = toSiteAbsoluteAssetPath(data.cover, slug);
    if (next) prefix = prefix.replace(/^(cover:\s*).*$/m, `$1${JSON.stringify(next)}`);
  }
  const rewriteLink = (token: Tokens.Link | Tokens.Image): string => {
    const resolved = token.type === 'link' ? resolveEntityLink(token.href, entities, slug) : null;
    // Relative document links use their HTML route base, even when read as /slug.md.
    let next = resolved?.href ?? toSiteAbsoluteAssetPath(token.href, slug);
    if (!next && token.type === 'link' && !/^[a-z][a-z\d+.-]*:/i.test(token.href) && !token.href.startsWith('//')) {
      try {
        const url = new URL(token.href, `https://markdown.invalid/${encodeURIComponent(slug)}/`);
        next = `${url.pathname}${url.search}${url.hash}`;
      } catch { /* Keep malformed ordinary links for the content validator. */ }
    }
    // Keep the author's label (including formatting and escaped brackets).
    const start = token.raw.startsWith('![') ? 2 : token.raw.startsWith('[') ? 1 : -1;
    let end = start, depth = 1;
    if (start >= 0) {
      for (; end < token.raw.length; end++) {
        if (token.raw[end] === '\\') { end++; continue; }
        if (token.raw[end] === '[') depth++;
        if (token.raw[end] === ']') { depth--; if (depth === 0) break; }
      }
    }
    const originalLabel = start >= 0 && end < token.raw.length ? token.raw.slice(start, end) : token.text;
    const label = token.type === 'link' ? rewriteTokens(originalLabel, token.tokens) : originalLabel;
    if ((!next || next === token.href) && label === originalLabel) return token.raw;
    return `${token.type === 'image' ? '!' : ''}[${label}](<${next || token.href}>${token.title ? ` ${JSON.stringify(token.title)}` : ''})`;
  };
  function rewriteTokens(raw: string, tokens: Token[]): string {
    let cursor = 0;
    let output = '';
    const nested = new Set<Token>();
    marked.walkTokens(tokens, (token) => {
      if (nested.has(token) || (token.type !== 'image' && token.type !== 'link')) return;
      // A link rewrites its own label recursively. Image alt text is prose.
      marked.walkTokens(token.tokens || [], (child) => { nested.add(child); });
      const position = raw.indexOf(token.raw, cursor);
      if (position < 0) return;
      output += raw.slice(cursor, position) + rewriteLink(token as Tokens.Link | Tokens.Image);
      cursor = position + token.raw.length;
    });
    return output + raw.slice(cursor);
  }
  let offset = 0;
  let body = '';
  for (const token of marked.lexer(content)) {
    const start = content.indexOf(token.raw, offset);
    if (start < 0) continue;
    body += content.slice(offset, start);
    const collection = expandedCollectionMarkdown(token, entities, slug);
    if (collection !== null) body += collection;
    else body += rewriteTokens(token.raw, [token]);
    offset = start + token.raw.length;
  }
  return prefix + body + content.slice(offset);
}
