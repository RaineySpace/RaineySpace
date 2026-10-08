import type { Entity, EntityCardOptions, EntityInlineOptions, EntityNavigationOptions, EntityRenderOptions, EntityType } from "./entities.ts";
import { entityAssetSrc, entityPath } from "./content-paths.ts";
// One escaped HTML renderer for React pages and build-time Markdown expansion.
// This module deliberately has no filesystem, React, or browser dependencies.
export const emptyCollectionMessage = {
  article: "暂时还没有公开文章。",
  project: "暂时还没有添加项目。",
  friend: "暂时还没有添加朋友。",
  contact: "暂时还没有添加联系方式。",
};

interface AuthoredEntityLink {
  /** HTML produced by the Markdown parser, never raw metadata. */
  html: string;
  href: string;
}

interface CardRenderOptions extends EntityCardOptions {
  root?: "article" | "span";
}

interface CardTemplateOptions extends CardRenderOptions {
  showCover?: boolean;
}

type CardRenderer = (item: Entity, options: CardTemplateOptions, presentation: EntityPresentation) => string;

interface EntityPresentation {
  inline: (item: Entity, options: EntityInlineOptions, authored?: AuthoredEntityLink) => string;
  card: CardRenderer;
  popover: { card: CardRenderer; showIcon: boolean; showCover: boolean };
  cardLink: "local" | "configured";
  header: { showIcon: boolean };
  cardActionLabel: string;
  urlActionLabel: string;
}

type EntityPresentationOverride = Partial<Pick<EntityPresentation, "inline" | "card" | "cardLink" | "urlActionLabel">> & {
  popover?: Partial<EntityPresentation["popover"]>;
  header?: Partial<EntityPresentation["header"]>;
  cardActionLabel: string;
};

const defaultEntityPresentation = {
  inline: renderDefaultEntityInlineHtml,
  card: renderStandardEntityCardHtml,
  popover: { card: renderStandardEntityCardHtml, showIcon: true, showCover: true },
  cardLink: "configured" as const,
  header: { showIcon: true },
};

// Every content type must declare its presentation; only differences are repeated.
const entityPresentationByType: Record<EntityType, EntityPresentationOverride> = {
  article: {
    card: renderArticleCardHtml,
    cardLink: "local",
    header: { showIcon: false },
    cardActionLabel: "阅读文章",
    urlActionLabel: "相关链接",
  },
  project: { cardActionLabel: "访问项目" },
  friend: { cardActionLabel: "访问站点" },
  contact: { cardActionLabel: "联系我" },
};

/** Contains renderer functions; resolve here instead of passing it through React props. */
export function getEntityPresentation(type: EntityType): EntityPresentation {
  const overrides = entityPresentationByType[type];
  return {
    ...defaultEntityPresentation,
    ...overrides,
    popover: { ...defaultEntityPresentation.popover, ...overrides.popover },
    header: { ...defaultEntityPresentation.header, ...overrides.header },
    urlActionLabel: overrides.urlActionLabel ?? overrides.cardActionLabel,
  };
}

export function renderEntityHtml(item: Entity, options: EntityRenderOptions = {}) {
  return options.variant === "inline"
    ? renderEntityInlineHtml(item, options)
    : renderEntityCardHtml(item, options);
}

export function renderEntityInlineHtml(item: Entity, options: EntityInlineOptions = {}, authored?: AuthoredEntityLink) {
  return getEntityPresentation(item.type).inline(item, options, authored);
}

export function renderEntityCardHtml(item: Entity, options: CardRenderOptions = {}) {
  const presentation = getEntityPresentation(item.type);
  const popover = options.root === "span";
  const render = popover ? presentation.popover.card : presentation.card;
  return render(item, {
    ...options,
    ...(popover ? { showIcon: presentation.popover.showIcon && options.showIcon !== false, showCover: presentation.popover.showCover } : {}),
    ...(presentation.cardLink === "local" ? { external: false, newTab: false } : {}),
  }, presentation);
}

export function escapeEntityHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderLinkAttributes(item: Entity, { newTab = false, external = false }: EntityNavigationOptions = {}, authoredHref?: string) {
  const href = authoredHref ?? (external ? item.url : entityPath(item.slug));
  const target = newTab && external && !/^mailto:/i.test(href) ? ' target="_blank" rel="noreferrer"' : "";
  const navigation = item.redirect && !external ? ' data-no-page-transition' : "";
  return `href="${escapeEntityHtml(href)}"${target}${navigation}`;
}

function renderMedia(item: Entity, size: "card" | "inline", name: string, { showCover = false, showIcon = true } = {}) {
  const initial = escapeEntityHtml(Array.from(name.trim())[0] || "·");
  const cover = size === "card" && showCover ? renderCardCover(item, showIcon) : "";
  const icon = showIcon && item.icon
    ? `<img class="entity-${size}-icon" src="${escapeEntityHtml(item.icon)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">`
    : "";
  const fallback = showIcon ? `<span class="entity-${size}-fallback"${icon ? " hidden" : ""}>${initial}</span>` : "";
  return `<span class="entity-${size}-media" aria-hidden="true">${cover}${icon}${fallback}</span>`;
}

function renderCardCover(item: Entity, hasFallback: boolean) {
  if (!item.cover) return "";
  const image = item.coverImage;
  const src = image?.displaySrc || image?.thumbnailSrc || entityAssetSrc(item.slug, item.cover);
  const responsive = image?.srcSet ? ` srcset="${escapeEntityHtml(image.srcSet)}" sizes="(max-width: 360px) calc(100vw - 40px), 320px"` : "";
  const dimensions = image?.width && image.height ? ` width="${image.width}" height="${image.height}"` : "";
  const fallback = `this.hidden=true${hasFallback ? "" : ";this.parentElement.hidden=true"}`;
  return `<img class="entity-card-cover" src="${escapeEntityHtml(src)}"${responsive}${dimensions} alt="" loading="lazy" decoding="async" onerror="${fallback}">`;
}

function renderStandardEntityCardHtml(item: Entity, { headingLevel = "h3", root = "article", showIcon = true, showCover = false, ...navigation }: CardTemplateOptions, presentation: EntityPresentation) {
  const inline = root === "span";
  const Root = inline ? "span" : "article";
  const Body = inline ? "span" : "div";
  const Name = inline ? "span" : headingLevel === "h2" ? "h2" : "h3";
  const Description = inline ? "span" : "p";
  const title = item.title;
  const label = `${presentation.cardActionLabel}：${title}`;
  const description = item.summary
    ? `<${Description} class="entity-card-description">${escapeEntityHtml(item.summary)}</${Description}>`
    : "";
  const media = showIcon || (showCover && item.cover) ? renderMedia(item, "card", title, { showCover, showIcon }) : "";
  return `<${Root} data-hover-card class="entity-card"><a class="entity-card-hit" ${renderLinkAttributes(item, navigation)} aria-label="${escapeEntityHtml(label)}"></a><${Body} class="entity-card-body">${media}<${Body} class="entity-card-copy"><${Name} class="entity-card-name">${escapeEntityHtml(title)}</${Name}>${description}</${Body}></${Body}></${Root}>`;
}

function renderDefaultEntityInlineHtml(item: Entity, {
  appearance = "text",
  size,
  showIcon = false,
  hoverCard = true,
  popoverShowIcon = true,
  placement = "auto",
  newTab = false,
  external = false,
}: EntityInlineOptions, authored?: AuthoredEntityLink) {
  const iconOnly = appearance === "icon";
  const chip = appearance === "chip" || iconOnly;
  const media = showIcon || iconOnly ? renderMedia(item, "inline", item.name) : "";
  const label = iconOnly ? ` aria-label="${escapeEntityHtml(item.name)}"` : "";
  const name = iconOnly ? "" : `<span class="entity-inline-name">${authored?.html ?? escapeEntityHtml(item.name)}</span>`;
  const sizeClass = size ? ` entity-size--${escapeEntityHtml(size)}` : "";
  const link = `<a class="entity-inline-link entity-inline-link--${chip ? "chip" : "text"}${iconOnly ? " entity-inline-link--icon" : ""}${sizeClass}" ${renderLinkAttributes(item, { newTab, external }, authored?.href)}${label}>${media}${name}</a>`;
  if (!hoverCard) return link;
  const position = placement === "top" ? ' data-placement="top"' : "";
  const card = renderEntityCardHtml(item, { root: "span", showIcon: popoverShowIcon, newTab, external });
  return `<span class="entity-chip${chip ? " entity-chip--compact" : ""}"${position}>${link}<span class="entity-chip-popover"><span class="entity-chip-popover-panel">${card}</span></span></span>`;
}

/** Article lists and embedded article cards share the same text layout. */
function renderArticleCardHtml(item: Entity, { headingLevel = 'h3', root = 'article', ...navigation }: CardRenderOptions) {
  const Block = root === 'span' ? 'span' : 'div';
  const Heading = root === 'span' ? 'span' : headingLevel;
  const Summary = root === 'span' ? 'span' : 'p';
  const date = item.date ? `<time datetime="${item.date.toISOString()}">${item.dateText}</time>` : '';
  const tags = item.tags.map((tag) => `<span class="tag">${escapeEntityHtml(tag)}</span>`).join('');
  // Article lists and standalone references keep their local, text-only layout.
  return `<a ${renderLinkAttributes(item, navigation)} data-hover-card class="post-card -mx-3 block rounded-xl p-3"><${root}><${Heading} class="mb-2 block text-base font-normal leading-[1.6] text-(--title)">${escapeEntityHtml(item.title)}</${Heading}><${Block} class="flex flex-wrap items-center gap-x-2 gap-y-1 meta">${date}${tags}</${Block}>${item.summary ? `<${Summary} class="mt-2 block text-sm leading-[1.75] text-(--secondary)">${escapeEntityHtml(item.summary)}</${Summary}>` : ''}</${root}></a>`;
}
