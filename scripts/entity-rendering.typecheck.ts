import type { EntityRenderOptions } from '../lib/entities.ts';

type RenderOptions<Options extends EntityRenderOptions> = Options;

/** Compiled by both typecheck configurations; no runtime test setup is needed. */
export type EntityRenderOptionContract = [
  RenderOptions<{ variant?: 'card' }>,
  RenderOptions<{ variant: 'card'; headingLevel: 'h2'; showIcon: false }>,
  RenderOptions<{ variant: 'inline'; appearance: 'icon'; external: true; newTab: true }>,
  // @ts-expect-error Card rendering has no inline appearance.
  RenderOptions<{ variant: 'card'; appearance: 'chip' }>,
  // @ts-expect-error Omitted variant still selects a card.
  RenderOptions<{ hoverCard: true }>,
  // @ts-expect-error Popover placement belongs to inline rendering.
  RenderOptions<{ variant: 'card'; placement: 'top' }>,
  // @ts-expect-error Inline rendering does not choose a heading level.
  RenderOptions<{ variant: 'inline'; headingLevel: 'h2' }>,
  // @ts-expect-error Inline sizing cannot be applied to cards.
  RenderOptions<{ variant: 'card'; size: 'sm' }>,
  // @ts-expect-error Preview icons belong to inline rendering.
  RenderOptions<{ variant: 'card'; popoverShowIcon: false }>,
];
