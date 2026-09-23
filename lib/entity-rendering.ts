import type { Entity, EntityRenderOptions } from "./entities.ts";
// One escaped HTML renderer for React pages and build-time Markdown expansion.
// This module deliberately has no filesystem, React, or browser dependencies.
export const emptyCollectionMessage = {
  project: "暂时还没有添加项目。",
  friend: "暂时还没有添加朋友。",
  contact: "暂时还没有添加联系方式。",
};

const VISIT_LABEL = { project: "访问项目", friend: "访问站点", contact: "联系我" };

export function escapeEntityHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function entityTitle(item: Entity) {
  return item.title ?? item.name;
}

function renderMedia(item: Entity, size: "card" | "inline", name: string) {
  const initial = escapeEntityHtml(Array.from(name.trim())[0] || "·");
  const fallback = `<span class="entity-${size}-fallback"${item.icon ? " hidden" : ""}>${initial}</span>`;
  const icon = item.icon
    ? `<img class="entity-${size}-icon" src="${escapeEntityHtml(item.icon)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">`
    : "";
  return `<span class="entity-${size}-media" aria-hidden="true">${icon}${fallback}</span>`;
}

export function renderEntityCardHtml(item: Entity, { headingLevel = "h3", root = "article", showIcon = true, newTab = true }: EntityRenderOptions & { root?: "article" | "span" } = {}) {
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
  const target = newTab && !/^mailto:/i.test(item.url) ? ' target="_blank" rel="noreferrer"' : "";
  return `<${Root} data-hover-card class="entity-card"><a class="entity-card-hit" href="${escapeEntityHtml(item.url)}"${target} aria-label="${escapeEntityHtml(label)}"></a><${Body} class="entity-card-body">${media}<${Body} class="entity-card-copy"><${Name} class="entity-card-name">${escapeEntityHtml(title)}</${Name}>${description}</${Body}></${Body}></${Root}>`;
}

export function renderEntityInlineHtml(item: Entity, {
  appearance = "text",
  size,
  showIcon = false,
  hoverCard = true,
  popoverShowIcon = true,
  placement = "auto",
  newTab = true,
}: EntityRenderOptions = {}) {
  const iconOnly = appearance === "icon";
  const chip = appearance === "chip" || iconOnly;
  const media = showIcon || iconOnly ? renderMedia(item, "inline", item.name) : "";
  const target = newTab && !/^mailto:/i.test(item.url) ? ' target="_blank" rel="noreferrer"' : "";
  const label = iconOnly ? ` aria-label="${escapeEntityHtml(item.name)}"` : "";
  const name = iconOnly ? "" : `<span class="entity-inline-name">${escapeEntityHtml(item.name)}</span>`;
  const sizeClass = size ? ` entity-size--${escapeEntityHtml(size)}` : "";
  const link = `<a class="entity-inline-link entity-inline-link--${chip ? "chip" : "text"}${iconOnly ? " entity-inline-link--icon" : ""}${sizeClass}" href="${escapeEntityHtml(item.url)}"${target}${label}>${media}${name}</a>`;
  if (!hoverCard) return link;
  const position = placement === "top" ? ' data-placement="top"' : "";
  const card = renderEntityCardHtml(item, { root: "span", showIcon: popoverShowIcon, newTab });
  return `<span class="entity-chip${chip ? " entity-chip--compact" : ""}"${position}>${link}<span class="entity-chip-popover"><span class="entity-chip-popover-panel">${card}</span></span></span>`;
}

export function renderEntityHtml(item: Entity, options: EntityRenderOptions = {}) {
  return options.variant === "inline"
    ? renderEntityInlineHtml(item, options)
    : renderEntityCardHtml(item, options);
}
