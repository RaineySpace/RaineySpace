import type { DisplayImage } from './optimized-images.ts';

/** A document's directory supplies its globally unique slug. */
export const entityTypes = ['article', 'project', 'friend', 'contact'] as const;
export type EntityType = typeof entityTypes[number];

export interface EntityBase {
  slug: string;
  title: string;
  name: string;
  summary: string;
  date: Date | null;
  dateText: string;
  updated: Date | null;
  tags: string[];
  keywords: string[];
  icon: string;
  cover: string;
  /** Derived image variants, never an authored metadata field. */
  coverImage?: DisplayImage;
  location: string;
  url: string;
  redirect: boolean;
  noindex: boolean;
  showHeader: boolean;
}

export type Entity<Type extends EntityType = EntityType> = EntityBase & (
  Type extends 'article'
    ? { type: Type; hidden: boolean; pinned: boolean }
    : { type: Type; hidden?: never; pinned?: never }
);

export function isIndexable(entity: Pick<Entity, 'noindex' | 'redirect'>) {
  return !entity.noindex && !entity.redirect;
}

export function compareEntityDates(a: Entity, b: Entity): number {
  if (!a.date && !b.date) return compareSlugs(a.slug, b.slug);
  if (!a.date) return 1;
  if (!b.date) return -1;
  return b.date.getTime() - a.date.getTime() || compareSlugs(a.slug, b.slug);
}

function compareSlugs(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function collectionEntities(entities: Iterable<Entity>, type: EntityType): Entity[] {
  return [...entities].filter((entity) => entity.type === type && !entity.hidden).sort((a, b) =>
    type === 'article' && Boolean(a.pinned) !== Boolean(b.pinned)
      ? a.pinned ? -1 : 1
      : compareEntityDates(a, b));
}

export interface EntityNavigationOptions {
  newTab?: boolean;
  /** Only explicit contact actions (e.g. the homepage footer) bypass the document. */
  external?: boolean;
}

export interface EntityInlineOptions extends EntityNavigationOptions {
  appearance?: 'text' | 'chip' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  hoverCard?: boolean;
  popoverShowIcon?: boolean;
  placement?: 'auto' | 'top';
}

export interface EntityCardOptions extends EntityNavigationOptions {
  headingLevel?: 'h2' | 'h3';
  /** Standalone article cards use their text-only template. */
  showIcon?: boolean;
}

export type EntityRenderOptions =
  | (EntityCardOptions & {
    variant?: 'card';
    appearance?: never;
    size?: never;
    hoverCard?: never;
    popoverShowIcon?: never;
    placement?: never;
  })
  | (EntityInlineOptions & {
    variant: 'inline';
    headingLevel?: never;
  });
