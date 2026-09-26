export interface SpringState {
  value: number;
  velocity: number;
}

export interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PhotoPose {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  emphasis: number;
  width: number;
  height: number;
}

export interface StripBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Exact solution for mass 1, stiffness 676, damping 52; independent of frame rate. */
export function advanceSpring(state: SpringState, target: number, seconds: number): SpringState {
  const offset = state.value - target;
  const coefficient = state.velocity + 26 * offset;
  const decay = Math.exp(-26 * Math.max(0, seconds));
  return {
    value: target + (offset + coefficient * Math.max(0, seconds)) * decay,
    velocity: (state.velocity - 26 * coefficient * Math.max(0, seconds)) * decay,
  };
}

export function springSettled(state: SpringState, target: number) {
  return Math.abs(state.value - target) < 0.001 && Math.abs(state.velocity) < 0.01;
}

export function photoWeight(distance: number) {
  return Math.abs(distance) < 2 ? Math.cos(Math.PI * distance / 4) ** 4 : 0;
}

/** Read the stationary slots, never the animated hit rectangles. */
export function photoFocus(slots: PhotoSlot[], x: number) {
  for (let i = 1; i < slots.length; i++) {
    if (x <= slots[i].x) {
      return i - 1 + clamp((x - slots[i - 1].x) / (slots[i].x - slots[i - 1].x), 0, 1);
    }
  }
  return Math.max(0, slots.length - 1);
}

function rotatedSize(width: number, height: number, rotation: number) {
  const radians = rotation * Math.PI / 180;
  return {
    width: width * Math.abs(Math.cos(radians)) + height * Math.abs(Math.sin(radians)),
    height: height * Math.abs(Math.cos(radians)) + width * Math.abs(Math.sin(radians)),
  };
}

export function photoStripLayout(slots: PhotoSlot[], focus: number, expansion: number, bounds: StripBounds): PhotoPose[] {
  if (!slots.length) return [];
  const amount = clamp(expansion, 0, 1);
  const weights = slots.map((_, i) => photoWeight(i - clamp(focus, 0, slots.length - 1)));
  const original = slots.map(slot => rotatedSize(slot.width, slot.height, slot.rotation));
  const poses = slots.map((slot, i) => {
    const emphasis = amount * weights[i];
    const scale = 1 + 0.3 * emphasis;
    const rotation = slot.rotation * (1 - emphasis);
    return { x: slot.x, y: slot.y, scale, rotation, emphasis, ...rotatedSize(slot.width * scale, slot.height * scale, rotation) };
  });

  for (let i = 1; i < poses.length; i++) {
    const restingGap = slots[i].x - slots[i - 1].x - (original[i].width + original[i - 1].width) / 2;
    const gap = restingGap + (6 - restingGap) * amount * Math.max(weights[i], weights[i - 1]);
    poses[i].x = poses[i - 1].x + (poses[i - 1].width + poses[i].width) / 2 + gap;
  }

  // Anchor the whole row around the continuous focal area, not a rounded index.
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const anchorOffset = weights.reduce((sum, weight, i) => sum + weight * (slots[i].x - poses[i].x), 0) / weightSum;
  let minOffset = -Infinity;
  let maxOffset = Infinity;
  const slack = poses.at(-1)!.x - poses[0].x + bounds.right - bounds.left;
  for (let i = 0; i < poses.length; i++) {
    // Both leading photos are protected at a midpoint. Neighbour constraints
    // fade in continuously, avoiding a jump when the nearest index changes.
    const influence = clamp((weights[i] - 0.25) / (photoWeight(0.5) - 0.25), 0, 1);
    const protection = influence * influence * (3 - 2 * influence);
    const allowance = slack * (1 - protection);
    const initialLeftClip = Math.max(0, bounds.left - slots[i].x + original[i].width / 2);
    const initialRightClip = Math.max(0, slots[i].x + original[i].width / 2 - bounds.right);
    minOffset = Math.max(minOffset, bounds.left - poses[i].x + poses[i].width / 2 - allowance - initialLeftClip * (1 - amount));
    maxOffset = Math.min(maxOffset, bounds.right - poses[i].x - poses[i].width / 2 + allowance + initialRightClip * (1 - amount));
  }
  // Exceptionally small viewports can only contain one of the two focal cards.
  if (minOffset > maxOffset) {
    const primary = poses[Math.round(clamp(focus, 0, poses.length - 1))];
    minOffset = bounds.left - primary.x + primary.width / 2;
    maxOffset = bounds.right - primary.x - primary.width / 2;
  }
  const offset = clamp(anchorOffset, minOffset, maxOffset);
  return poses.map((pose, i) => ({
    ...pose,
    x: amount ? pose.x + offset : slots[i].x,
    y: amount ? clamp(pose.y, bounds.top + pose.height / 2, bounds.bottom - pose.height / 2) : slots[i].y,
  }));
}
