const ENTITY_CHIP_POPOVER_GAP = 8;
const ENTITY_CHIP_POPOVER_VIEWPORT_MARGIN = 20;

export function alignEntityChipPopovers(root: HTMLElement) {
  const chips = root.querySelectorAll<HTMLElement>(".entity-chip");
  if (chips.length === 0) return;

  const box = root.closest("[data-entity-boundary], .markdown")?.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const minLeft = Math.max(ENTITY_CHIP_POPOVER_VIEWPORT_MARGIN, box?.left ?? 0);
  const maxRight = Math.min(
    window.innerWidth - ENTITY_CHIP_POPOVER_VIEWPORT_MARGIN,
    box?.right ?? window.innerWidth,
  );

  chips.forEach((chip) => {
    const popover = chip.querySelector<HTMLElement>(".entity-chip-popover");
    if (!popover) return;

    const chipRect = chip.getBoundingClientRect();
    popover.style.maxWidth = `min(20rem, ${Math.max(0, maxRight - minLeft)}px)`;
    const panel = popover.querySelector<HTMLElement>(".entity-chip-popover-panel");
    const width = panel?.offsetWidth || popover.offsetWidth;
    const height = panel?.offsetHeight ?? 0;
    const spaceBelow = viewportHeight - chipRect.bottom - ENTITY_CHIP_POPOVER_GAP;
    const spaceAbove = chipRect.top - ENTITY_CHIP_POPOVER_GAP;
    const placeAbove = chip.dataset.placement === "top" || (height > 0 && spaceBelow < height && spaceAbove > spaceBelow);

    const left = Math.max(minLeft, Math.min(chipRect.left, maxRight - width)) - chipRect.left;

    popover.style.left = `${left}px`;
    popover.style.right = "auto";
    popover.style.width = "";

    if (placeAbove) {
      popover.style.top = "auto";
      popover.style.bottom = `calc(100% + ${ENTITY_CHIP_POPOVER_GAP}px)`;
    } else {
      popover.style.top = `calc(100% + ${ENTITY_CHIP_POPOVER_GAP}px)`;
      popover.style.bottom = "auto";
    }
  });
}
