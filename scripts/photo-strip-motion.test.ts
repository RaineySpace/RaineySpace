import assert from "node:assert/strict";
import test from "node:test";
import { advanceSpring, photoFocus, photoStripLayout, photoWeight, type PhotoSlot, type SpringState } from "../lib/photo-strip-motion.ts";

const rotations = [-2, 1, -1, 2, -1, 1];
const makeSlots = (bleed = 72): PhotoSlot[] => rotations.map((rotation, i) => ({
  x: bleed + 60 + i * 97.6, y: 42 + 112 * 2 / 3, width: 112, height: 112 * 4 / 3, rotation,
}));
const bounds = { left: 4, right: 772, top: 4, bottom: 245.3333333333 };
const close = (actual: number, expected: number, tolerance = 0.000001) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("resting cards retain their original positions, size and stacking geometry", () => {
  const slots = makeSlots();
  for (const focus of [0, 2.5, 5]) {
    photoStripLayout(slots, focus, 0, bounds).forEach((pose, i) => {
      close(pose.x, slots[i].x);
      close(pose.y, slots[i].y);
      close(pose.rotation, rotations[i]);
      close(pose.scale, 1);
    });
  }
});

test("the focal card and neighbours share magnification, with six-pixel uncovered edges", () => {
  const poses = photoStripLayout(makeSlots(), 2, 1, bounds);
  close(poses[2].scale, 1.3);
  close(poses[1].scale, 1.075);
  close(poses[3].scale, 1.075);
  close(poses[0].scale, 1);
  for (const i of [1, 2]) close(poses[i + 1].x - poses[i].x - (poses[i].width + poses[i + 1].width) / 2, 6);
  const halfway = photoStripLayout(makeSlots(), 2.5, 1, bounds);
  close(halfway[2].scale, halfway[3].scale);
  close(halfway[2].scale, 1.2185660172);
});

test("magnification and displacement begin together on the first animation frame", () => {
  const slots = makeSlots();
  const amount = advanceSpring({ value: 0, velocity: 0 }, 1, 1 / 60).value;
  const poses = photoStripLayout(slots, 2, amount, bounds);
  assert.ok(poses[2].scale > 1 && poses[1].scale > 1 && poses[3].scale > 1);
  assert.ok(poses[1].x < slots[1].x && poses[3].x > slots[3].x);
  assert.ok(Math.abs(poses[2].rotation) < Math.abs(slots[2].rotation));
});

test("crossing an index or midpoint is continuous, including narrow scrolled bounds", () => {
  for (const bleed of [0, 72]) {
    const slots = makeSlots(bleed);
    for (const scroll of bleed ? [0] : [0, 140, 278]) {
      const visible = { ...bounds, left: scroll + 4, right: scroll + (bleed ? 772 : 346) };
      for (const boundary of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5]) {
        const before = photoStripLayout(slots, boundary - 0.00001, 1, visible);
        const after = photoStripLayout(slots, boundary + 0.00001, 1, visible);
        after.forEach((pose, i) => {
          close(pose.x, before[i].x, 0.01);
          close(pose.scale, before[i].scale, 0.0001);
        });
      }
    }
  }
});

test("the leading card fits the viewport at every focal position, including scroll endpoints", () => {
  for (const width of [350, 600, 776]) {
    const slots = makeSlots(width === 776 ? 72 : 0);
    for (const scroll of width === 776 ? [0] : [0, Math.max(0, 628 - width)]) {
      const visible = { ...bounds, left: scroll + 4, right: scroll + width - 4 };
      for (let q = 0; q <= 5; q += 0.025) {
        const poses = photoStripLayout(slots, q, 1, visible);
        const primary = poses[Math.round(q)];
        assert.ok(primary.x - primary.width / 2 >= visible.left - 0.0001);
        assert.ok(primary.x + primary.width / 2 <= visible.right + 0.0001);
        for (const pose of poses) {
          assert.ok(pose.y - pose.height / 2 >= visible.top - 0.0001);
          assert.ok(pose.y + pose.height / 2 <= visible.bottom + 0.0001);
          assert.ok(pose.scale >= 1 && pose.scale <= 1.3);
        }
      }
    }
  }
});

test("spring timing agrees at 60Hz and 120Hz, with no overshoot on entry", () => {
  const run = (hz: number) => {
    let state: SpringState = { value: 0, velocity: 0 };
    for (let i = 0; i < hz / 4; i++) {
      state = advanceSpring(state, 1, 1 / hz);
      assert.ok(state.value >= 0 && state.value <= 1);
    }
    return state;
  };
  const a = run(60), b = run(120);
  close(a.value, b.value);
  close(a.velocity, b.velocity);
  assert.ok(a.value > 0.98);
});

test("retargeting preserves position and velocity, then smoothly reverses", () => {
  const entering = advanceSpring({ value: 0, velocity: 0 }, 1, 0.08);
  const interrupted = advanceSpring(entering, 0, 0);
  close(interrupted.value, entering.value);
  close(interrupted.velocity, entering.velocity);
  const next = advanceSpring(interrupted, 0, 0.001);
  assert.ok(Math.abs(next.value - interrupted.value) < 0.01);
  assert.ok(next.velocity > 0, "existing momentum is not discarded");
  const leaving = advanceSpring(next, 0, 0.3);
  assert.ok(leaving.velocity < 0 && leaving.value < 0.02);
});

test("focus comes from stationary slot centres and clamps to first and last", () => {
  const slots = makeSlots();
  close(photoFocus(slots, slots[2].x), 2);
  close(photoFocus(slots, (slots[2].x + slots[3].x) / 2), 2.5);
  close(photoFocus(slots, -1000), 0);
  close(photoFocus(slots, 1000), 5);
  close(photoWeight(2), 0);
  close(photoWeight(-2), 0);
  assert.deepEqual(photoStripLayout([], 0, 1, bounds), []);
});
