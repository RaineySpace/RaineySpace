import { marked } from "marked";
import {
  emptyCollectionMessage,
  entityTitle,
  escapeEntityHtml as escapeHtml,
  renderEntityHtml,
} from "./entity-rendering.ts";

export { emptyCollectionMessage } from "./entity-rendering.ts";

import type { Entity, EntityKind } from "./entities.ts";
import type { loadRegistries } from "./registry.ts";

type Registries = ReturnType<typeof loadRegistries>;
interface DataRef { kind: EntityKind; id: string }
interface ResolvedDataRef extends DataRef { items: Entity[] }
// A mutable view of marked tokens: a data reference is rewritten into an HTML token.
interface MutableToken {
  type: string;
  raw: string;
  text?: string;
  href?: string;
  title?: string | null;
  tokens?: MutableToken[];
  items?: MutableToken[];
  header?: { tokens?: MutableToken[] }[];
  rows?: { tokens?: MutableToken[] }[][];
  pre?: boolean;
  block?: boolean;
}
interface RefOptions {
  registries: Registries;
  format?: "card" | "plain";
  source?: string;
  blockAllowed?: boolean;
}
interface Replacement { raw: string; next: string }

const DATA_REF_TITLE = /^(project|friend|contact):(\*|[^\s:]+)$/;

export function parseDataRefTitle(title: unknown): DataRef | null {
  if (title == null || title === "") return null;
  const trimmed = String(title).trim();
  if (!trimmed.startsWith("project:") && !trimmed.startsWith("friend:") && !trimmed.startsWith("contact:")) return null;
  const match = trimmed.match(DATA_REF_TITLE);
  if (!match) {
    throw new Error(`invalid data reference title "${title}"`);
  }
  return { kind: match[1] as EntityKind, id: match[2] };
}

export function resolveDataRef(ref: DataRef, registries: Registries): ResolvedDataRef {
  const list = registries[ref.kind] || [];
  if (ref.id === "*") return { ...ref, items: list };
  const item = list.find((entity) => entity.id === ref.id);
  if (!item) throw new Error(`unknown ${ref.kind} "${ref.id}"`);
  return { ...ref, items: [item] };
}

function escapeMarkdownLinkText(value: string) {
  return String(value).replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function withSource(source: string | undefined, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (source && !message.startsWith(`${source}:`)) {
    return new Error(`${source}: ${message}`);
  }
  return error instanceof Error ? error : new Error(message);
}

function isInsignificantInline(token: MutableToken) {
  if (!token) return true;
  if (token.type === "space" || token.type === "br") return true;
  if (token.type === "text" && !String(token.text).replace(/\s/g, "")) return true;
  return false;
}

export function getSoleDataRefLink(paragraph: MutableToken) {
  let link: MutableToken | null = null;
  for (const token of paragraph.tokens || []) {
    if (isInsignificantInline(token)) continue;
    if (token.type !== "link") return null;
    const ref = parseDataRefTitle(token.title);
    if (!ref) return null;
    if (link) return null;
    link = token;
  }
  return link;
}

function visitChildTokenLists(token: MutableToken, visit: (tokens: MutableToken[]) => void) {
  if (Array.isArray(token.tokens)) visit(token.tokens);
  if (Array.isArray(token.items)) {
    for (const item of token.items) visitChildTokenLists(item, visit);
  }
  if (Array.isArray(token.header)) {
    for (const cell of token.header) visit(cell.tokens || []);
  }
  if (Array.isArray(token.rows)) {
    for (const row of token.rows) {
      for (const cell of row) visit(cell.tokens || []);
    }
  }
}

export function collectDataRefErrors(content: string, registries: Registries) {
  const errors: string[] = [];

  const visit = (tokens: MutableToken[]) => {
    for (const token of tokens || []) {
      if (token.type === "link") {
        try {
          const ref = parseDataRefTitle(token.title);
          if (ref) resolveDataRef(ref, registries);
        } catch (error) {
          errors.push((error instanceof Error ? error.message : String(error)));
        }
        continue;
      }
      visitChildTokenLists(token, visit);
    }
  };

  visit(marked.lexer(content));
  return errors;
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

function renderInlineMarkdown(resolved: ResolvedDataRef, token: MutableToken) {
  if (resolved.id === "*" && resolved.items.length === 0) {
    return `[${token.text}](${token.href})`;
  }
  return resolved.items
    .map((item) => `[${escapeMarkdownLinkText(item.name)}](${item.url})`)
    .join("、");
}

function renderBlockMarkdown(resolved: ResolvedDataRef) {
  if (resolved.items.length === 0) return emptyCollectionMessage[resolved.kind];
  return resolved.items
    .map((item) => {
      const link = `[${escapeMarkdownLinkText(entityTitle(item))}](${item.url})`;
      return item.description ? `- ${link}：${item.description}` : `- ${link}`;
    })
    .join("\n");
}

function renderPlainInlineHtml(resolved: ResolvedDataRef, token: MutableToken) {
  if (resolved.id === "*" && resolved.items.length === 0) {
    return `<a href="${escapeHtml(token.href)}">${escapeHtml(token.text)}</a>`;
  }
  return resolved.items
    .map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>`)
    .join("、");
}

function renderInlineHtml(resolved: ResolvedDataRef, token: MutableToken, format: "card" | "plain" = "card") {
  if (format === "plain") return renderPlainInlineHtml(resolved, token);
  if (resolved.id === "*" && resolved.items.length === 0) {
    return `<a href="${escapeHtml(token.href)}">${escapeHtml(token.text)}</a>`;
  }
  return resolved.items.map((item) => renderEntityHtml(item, { variant: "inline", newTab: false })).join("、");
}

function renderBlockHtml(resolved: ResolvedDataRef, format: "card" | "plain") {
  if (resolved.items.length === 0) {
    return `<p>${emptyCollectionMessage[resolved.kind]}</p>\n`;
  }
  if (format === "plain") {
    const items = resolved.items
      .map((item) => {
        const link = `<a href="${escapeHtml(item.url)}">${escapeHtml(entityTitle(item))}</a>`;
        return item.description ? `<li>${link}：${escapeHtml(item.description)}</li>` : `<li>${link}</li>`;
      })
      .join("");
    return `<ul>\n${items}\n</ul>\n`;
  }
  const cards = resolved.items.map((item) => renderEntityHtml(item, { variant: "card" })).join("");
  return `<div class="entity-card-list">${cards}</div>\n`;
}

function assignHtmlToken(token: MutableToken, html: string, block: boolean) {
  token.type = "html";
  token.raw = html;
  token.text = html;
  token.pre = Boolean(block);
  token.block = Boolean(block);
  delete token.tokens;
  delete token.href;
  delete token.title;
  delete token.items;
}

export function transformDataRefTokens(tokens: MutableToken[], {
  registries,
  format = "card",
  source,
  blockAllowed = true,
}: RefOptions) {
  for (const token of tokens || []) {
    try {
      if (token.type === "paragraph" && blockAllowed) {
        const link = getSoleDataRefLink(token);
        if (link) {
          const resolved = resolveDataRef(parseDataRefTitle(link.title)!, registries);
          assignHtmlToken(token, renderBlockHtml(resolved, format), true);
          continue;
        }
      }

      if (token.type === "link") {
        const ref = parseDataRefTitle(token.title);
        if (ref) {
          const resolved = resolveDataRef(ref, registries);
          assignHtmlToken(token, renderInlineHtml(resolved, token, format), false);
          continue;
        }
      }
    } catch (error) {
      throw withSource(source, error);
    }

    visitChildTokenLists(token, (childTokens) => {
      transformDataRefTokens(childTokens, { registries, format, source, blockAllowed: false });
    });
  }
}

function applyReplacements(source: string, replacements: Replacement[]) {
  let output = source;
  let searchFrom = 0;
  for (const { raw, next } of replacements) {
    const index = output.indexOf(raw, searchFrom);
    if (index === -1) continue;
    output = `${output.slice(0, index)}${next}${output.slice(index + raw.length)}`;
    searchFrom = index + next.length;
  }
  return output;
}

function collectExpansions(tokens: MutableToken[], registries: Registries, source: string | undefined, blockAllowed: boolean, replacements: Replacement[]) {
  for (const token of tokens || []) {
    try {
      if (token.type === "paragraph" && blockAllowed) {
        const link = getSoleDataRefLink(token);
        if (link) {
          const resolved = resolveDataRef(parseDataRefTitle(link.title)!, registries);
          const trailing = token.raw.match(/\n*$/)?.[0] || "";
          replacements.push({ raw: token.raw, next: `${renderBlockMarkdown(resolved)}${trailing}` });
          continue;
        }
      }

      if (token.type === "link") {
        const ref = parseDataRefTitle(token.title);
        if (ref) {
          const resolved = resolveDataRef(ref, registries);
          replacements.push({ raw: token.raw, next: renderInlineMarkdown(resolved, token) });
          continue;
        }
      }
    } catch (error) {
      throw withSource(source, error);
    }

    visitChildTokenLists(token, (childTokens) => {
      collectExpansions(childTokens, registries, source, false, replacements);
    });
  }
}

function stripDataRefDefinitions(source: string) {
  return source.replace(
    /^[ \t]*\[(?:[^\]]+)\]:[ \t]+\S+[ \t]+(?:"(?:project|friend|contact):[^"]*"|'(?:project|friend|contact):[^']*'|\((?:project|friend|contact):[^)]*\))[ \t]*\r?\n?/gm,
    "",
  );
}

function splitFrontmatter(source: string) {
  const match = String(source).match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!match) return { frontmatter: "", body: source };
  return { frontmatter: match[0], body: source.slice(match[0].length) };
}

export function expandDataRefsInMarkdown(source: string, registries: Registries, sourceLabel?: string) {
  const { frontmatter, body } = splitFrontmatter(source);
  const replacements: Replacement[] = [];
  collectExpansions(marked.lexer(body), registries, sourceLabel, true, replacements);
  return frontmatter + stripDataRefDefinitions(applyReplacements(body, replacements));
}

export function renderDataRefHtml(content: string, { registries, format = "card", source }: RefOptions) {
  const tokens = marked.lexer(content);
  transformDataRefTokens(tokens, { registries, format, source });
  return marked.parser(tokens);
}
