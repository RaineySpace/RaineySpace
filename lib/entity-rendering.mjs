// One escaped HTML renderer for React pages and build-time Markdown expansion.
// This module deliberately has no filesystem, React, or browser dependencies.
export const emptyCollectionMessage = {
  project: "暂时还没有添加项目。",
  friend: "暂时还没有添加朋友。",
};

const VISIT_LABEL = { project: "访问项目", friend: "访问站点" };

export function escapeEntityHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** @param {import("./entities").Entity} item */
export function entityTitle(item) {
  return item.title ?? item.name;
}

function renderMedia(item, size, name) {
  const initial = escapeEntityHtml(Array.from(name.trim())[0] || "·");
  const fallback = `<span class="entity-${size}-fallback"${item.icon ? " hidden" : ""}>${initial}</span>`;
  const icon = item.icon
    ? `<img class="entity-${size}-icon" src="${escapeEntityHtml(item.icon)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">`
    : "";
  return `<span class="entity-${size}-media" aria-hidden="true">${icon}${fallback}</span>`;
}

/**
 * @param {import("./entities").Entity} item
 * @param {import("./entities").EntityRenderOptions & {root?: "article" | "span"}} [options]
 */
export function renderEntityCardHtml(item, { headingLevel = "h3", root = "article", showIcon = true, newTab = true } = {}) {
  const inline = root === "span";
  const Root = inline ? "span" : "article";
  const Body = inline ? "span" : "div";
  const Name = inline ? "span" : headingLevel === "h2" ? "h2" : "h3";
  const Description = inline ? "span" : "p";
  const title = entityTitle(item);
  const label = `${VISIT_LABEL[item.kind]}：${title}`;
  const description = item.description
    ? `<${Description} class="entity-card-description">${escapeEntityHtml(item.description)}</${Description}>`
    : "";
  const media = showIcon ? renderMedia(item, "card", title) : "";
  const target = newTab ? ' target="_blank" rel="noreferrer"' : "";
  return `<${Root} data-hover-card class="entity-card"><a class="entity-card-hit" href="${escapeEntityHtml(item.url)}"${target} aria-label="${escapeEntityHtml(label)}"></a><${Body} class="entity-card-body">${media}<${Body} class="entity-card-copy"><${Name} class="entity-card-name">${escapeEntityHtml(title)}</${Name}>${description}</${Body}></${Body}></${Root}>`;
}

/**
 * @param {import("./entities").Entity} item
 * @param {import("./entities").EntityRenderOptions} [options]
 */
export function renderEntityInlineHtml(item, {
  appearance = "text",
  showIcon = false,
  hoverCard = true,
  popoverShowIcon = true,
  placement = "auto",
  newTab = true,
} = {}) {
  const chip = appearance === "chip";
  const media = showIcon ? renderMedia(item, "inline", item.name) : "";
  const target = newTab ? ' target="_blank" rel="noreferrer"' : "";
  const link = `<a class="entity-inline-link entity-inline-link--${chip ? "chip" : "text"}" href="${escapeEntityHtml(item.url)}"${target}>${media}<span class="entity-inline-name">${escapeEntityHtml(item.name)}</span></a>`;
  if (!hoverCard) return link;
  const position = placement === "top" ? ' data-placement="top"' : "";
  const card = renderEntityCardHtml(item, { root: "span", showIcon: popoverShowIcon, newTab });
  return `<span class="entity-chip${chip ? " entity-chip--compact" : ""}"${position}>${link}<span class="entity-chip-popover"><span class="entity-chip-popover-panel">${card}</span></span></span>`;
}

/**
 * @param {import("./entities").Entity} item
 * @param {import("./entities").EntityRenderOptions} [options]
 */
export function renderEntityHtml(item, options = {}) {
  return options.variant === "inline"
    ? renderEntityInlineHtml(item, options)
    : renderEntityCardHtml(item, options);
}
