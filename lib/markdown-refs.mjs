import { marked } from "marked";

const DATA_REF_TITLE = /^(project|friend):(\*|[^\s:]+)$/;
const VISIT_LABEL = {
  project: "访问项目",
  friend: "访问站点",
};
const EMPTY_BLOCK_MESSAGE = {
  project: "暂时还没有添加项目。",
  friend: "暂时还没有添加朋友。",
};

export function parseDataRefTitle(title) {
  if (title == null || title === "") return null;
  const trimmed = String(title).trim();
  if (!trimmed.startsWith("project:") && !trimmed.startsWith("friend:")) return null;
  const match = trimmed.match(DATA_REF_TITLE);
  if (!match) {
    throw new Error(`invalid data reference title "${title}"`);
  }
  return { kind: match[1], id: match[2] };
}

export function resolveDataRef(ref, registries) {
  const list = registries[ref.kind] || [];
  if (ref.id === "*") return { ...ref, items: list };
  const item = list.find((entity) => entity.id === ref.id);
  if (!item) throw new Error(`unknown ${ref.kind} "${ref.id}"`);
  return { ...ref, items: [item] };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeMarkdownLinkText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function entityInitial(name) {
  return Array.from(String(name || "").trim())[0] || "·";
}

function withSource(source, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (source && !message.startsWith(`${source}:`)) {
    return new Error(`${source}: ${message}`);
  }
  return error instanceof Error ? error : new Error(message);
}

function isInsignificantInline(token) {
  if (!token) return true;
  if (token.type === "space" || token.type === "br") return true;
  if (token.type === "text" && !String(token.text).replace(/\s/g, "")) return true;
  return false;
}

export function getSoleDataRefLink(paragraph) {
  let link = null;
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

function visitChildTokenLists(token, visit) {
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

export function collectDataRefErrors(content, registries) {
  const errors = [];

  const visit = (tokens) => {
    for (const token of tokens || []) {
      if (token.type === "link") {
        try {
          const ref = parseDataRefTitle(token.title);
          if (ref) resolveDataRef(ref, registries);
        } catch (error) {
          errors.push(error.message);
        }
        continue;
      }
      visitChildTokenLists(token, visit);
    }
  };

  visit(marked.lexer(content));
  return errors;
}

export function stripElementsByClass(html, className) {
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

function renderInlineMarkdown(resolved, token) {
  if (resolved.id === "*" && resolved.items.length === 0) {
    return `[${token.text}](${token.href})`;
  }
  return resolved.items
    .map((item) => `[${escapeMarkdownLinkText(item.name)}](${item.url})`)
    .join("、");
}

function renderBlockMarkdown(resolved) {
  if (resolved.items.length === 0) return EMPTY_BLOCK_MESSAGE[resolved.kind];
  return resolved.items
    .map((item) => {
      const link = `[${escapeMarkdownLinkText(item.name)}](${item.url})`;
      return item.description ? `- ${link}：${item.description}` : `- ${link}`;
    })
    .join("\n");
}

function renderFallbackSpan(className, name) {
  return `<span class="${className}">${escapeHtml(entityInitial(name))}</span>`;
}

function renderMedia(item, { mediaClass, iconClass, fallbackClass }) {
  const initial = renderFallbackSpan(fallbackClass, item.name);
  if (!item.image) {
    return `<span class="${mediaClass}" aria-hidden="true">${initial}</span>`;
  }
  return `<span class="${mediaClass}" aria-hidden="true"><img class="${iconClass}" src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${initial.replace(`class="${fallbackClass}"`, `class="${fallbackClass}" hidden`)}</span>`;
}

function renderCardMedia(item) {
  return renderMedia(item, {
    mediaClass: "entity-card-media",
    iconClass: "entity-card-icon",
    fallbackClass: "entity-card-fallback",
  });
}

function renderChipMedia(item) {
  return renderMedia(item, {
    mediaClass: "entity-chip-media",
    iconClass: "entity-chip-icon",
    fallbackClass: "entity-chip-fallback",
  });
}

function renderPlainInlineHtml(resolved, token) {
  if (resolved.id === "*" && resolved.items.length === 0) {
    return `<a href="${escapeHtml(token.href)}">${escapeHtml(token.text)}</a>`;
  }
  return resolved.items
    .map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>`)
    .join("、");
}

export function renderEntityCardHtml(item, { headingLevel = "h3", root = "article" } = {}) {
  const inline = root === "span";
  const Root = inline ? "span" : "article";
  const Body = inline ? "span" : "div";
  const Copy = inline ? "span" : "div";
  const Name = inline ? "span" : headingLevel === "h2" ? "h2" : "h3";
  const Description = inline ? "span" : "p";
  const label = `${VISIT_LABEL[item.kind]}：${item.name}`;
  const description = item.description
    ? `<${Description} class="entity-card-description">${escapeHtml(item.description)}</${Description}>`
    : "";
  return `<${Root} data-hover-card class="entity-card"><a class="entity-card-hit" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(label)}"></a><${Body} class="entity-card-body">${renderCardMedia(item)}<${Copy} class="entity-card-copy"><${Name} class="entity-card-name">${escapeHtml(item.name)}</${Name}>${description}</${Copy}></${Body}></${Root}>`;
}

function renderEntityChipHtml(item) {
  const label = `${VISIT_LABEL[item.kind]}：${item.name}`;
  return `<span class="entity-chip"><a class="entity-chip-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(label)}">${renderChipMedia(item)}<span class="entity-chip-name">${escapeHtml(item.name)}</span></a><span class="entity-chip-popover" aria-hidden="true"><span class="entity-chip-popover-panel">${renderEntityCardHtml(item, { root: "span" })}</span></span></span>`;
}

function renderInlineHtml(resolved, token, format = "card") {
  if (format === "plain") return renderPlainInlineHtml(resolved, token);
  if (resolved.id === "*" && resolved.items.length === 0) {
    return `<a href="${escapeHtml(token.href)}">${escapeHtml(token.text)}</a>`;
  }
  return resolved.items.map((item) => renderEntityChipHtml(item)).join("、");
}

function renderBlockHtml(resolved, format) {
  if (resolved.items.length === 0) {
    return `<p>${EMPTY_BLOCK_MESSAGE[resolved.kind]}</p>\n`;
  }
  if (format === "plain") {
    const items = resolved.items
      .map((item) => {
        const link = `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>`;
        return item.description ? `<li>${link}：${escapeHtml(item.description)}</li>` : `<li>${link}</li>`;
      })
      .join("");
    return `<ul>\n${items}\n</ul>\n`;
  }
  const cards = resolved.items.map((item) => renderEntityCardHtml(item)).join("");
  return `<div class="entity-card-list">${cards}</div>\n`;
}

function assignHtmlToken(token, html, block) {
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

/**
 * @param {unknown[]} tokens
 * @param {{
 *   registries: { project: object[], friend: object[] },
 *   format?: "card" | "plain",
 *   source?: string,
 *   blockAllowed?: boolean,
 * }} [options]
 */
export function transformDataRefTokens(tokens, {
  registries,
  format = "card",
  source,
  blockAllowed = true,
} = {}) {
  for (const token of tokens || []) {
    try {
      if (token.type === "paragraph" && blockAllowed) {
        const link = getSoleDataRefLink(token);
        if (link) {
          const resolved = resolveDataRef(parseDataRefTitle(link.title), registries);
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

function applyReplacements(source, replacements) {
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

function collectExpansions(tokens, registries, source, blockAllowed, replacements) {
  for (const token of tokens || []) {
    try {
      if (token.type === "paragraph" && blockAllowed) {
        const link = getSoleDataRefLink(token);
        if (link) {
          const resolved = resolveDataRef(parseDataRefTitle(link.title), registries);
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

function stripDataRefDefinitions(source) {
  return source.replace(
    /^[ \t]*\[(?:[^\]]+)\]:[ \t]+\S+[ \t]+(?:"(?:project|friend):[^"]*"|'(?:project|friend):[^']*'|\((?:project|friend):[^)]*\))[ \t]*\r?\n?/gm,
    "",
  );
}

function splitFrontmatter(source) {
  const match = String(source).match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!match) return { frontmatter: "", body: source };
  return { frontmatter: match[0], body: source.slice(match[0].length) };
}

export function expandDataRefsInMarkdown(source, registries, sourceLabel) {
  const { frontmatter, body } = splitFrontmatter(source);
  const replacements = [];
  collectExpansions(marked.lexer(body), registries, sourceLabel, true, replacements);
  return frontmatter + stripDataRefDefinitions(applyReplacements(body, replacements));
}

export function renderDataRefHtml(content, { registries, format = "card", source } = {}) {
  const tokens = marked.lexer(content);
  transformDataRefTokens(tokens, { registries, format, source });
  return marked.parser(tokens);
}

export const emptyCollectionMessage = EMPTY_BLOCK_MESSAGE;
