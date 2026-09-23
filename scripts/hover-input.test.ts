import assert from "node:assert/strict";
import test from "node:test";
import { createHoverInput } from "../lib/hover-input.ts";

function fixture(canHover = true) {
  const input = createHoverInput();
  const media = Object.assign(new EventTarget(), { matches: canHover });
  const document = Object.assign(new EventTarget(), {
    documentElement: { dataset: {} as DOMStringMap }, visibilityState: "visible",
  });
  const browser = Object.assign(new EventTarget(), {
    matchMedia(query: string) {
      assert.equal(query, "(any-hover: hover)");
      return media;
    },
  });
  const connect = () => input.connect(browser as unknown as Window, document as unknown as Document);
  const disconnect = connect();
  const pointer = (pointerType: string, type = "pointerover") => {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerType });
    document.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, "native click, scroll and gesture behavior is preserved");
  };
  const capability = (matches: boolean) => {
    media.matches = matches;
    media.dispatchEvent(new Event("change"));
  };
  return { input, document, browser, connect, disconnect, pointer, capability };
}

test("mixed input clears hover before touch down and restores it on mouse movement", () => {
  const { input, document, pointer, disconnect } = fixture();
  assert.deepEqual(input.getSnapshot(), { mode: "none", hoverEnabled: false });
  assert.equal(document.documentElement.dataset.hoverEnabled, "false");
  pointer("mouse");
  assert.equal(input.getSnapshot().hoverEnabled, true);
  pointer("touch");
  assert.deepEqual(input.getSnapshot(), { mode: "touch", hoverEnabled: false });
  assert.equal(document.documentElement.dataset.hoverEnabled, "false");
  assert.equal(document.documentElement.dataset.inputMode, "touch");
  pointer("touch", "pointerdown");
  document.dispatchEvent(new Event("mouseover"));
  document.dispatchEvent(new Event("mousemove"));
  assert.equal(input.getSnapshot().hoverEnabled, false, "compatibility mouse events cannot reenable hover");
  pointer("mouse", "pointermove");
  assert.equal(input.getSnapshot().hoverEnabled, true);
  pointer("pen");
  assert.deepEqual(input.getSnapshot(), { mode: "pen", hoverEnabled: false });
  disconnect();
});

test("hot-plugged mouse needs a new mouse event; primary pointer capability is irrelevant", () => {
  const { input, pointer, capability, disconnect } = fixture(false);
  pointer("mouse");
  assert.equal(input.getSnapshot().hoverEnabled, false);
  pointer("touch");
  capability(true);
  assert.equal(input.getSnapshot().hoverEnabled, false);
  pointer("mouse", "pointermove");
  assert.equal(input.getSnapshot().hoverEnabled, true);
  capability(false);
  assert.equal(input.getSnapshot().hoverEnabled, false);
  capability(true);
  assert.equal(input.getSnapshot().hoverEnabled, false);
  pointer("mouse", "pointermove");
  assert.equal(input.getSnapshot().hoverEnabled, true);
  disconnect();
});

test("keyboard and unknown pointers never enable hover; keyboard works without a mouse", () => {
  const { input, document, pointer, capability, disconnect } = fixture();
  pointer("mouse");
  document.dispatchEvent(new Event("keydown"));
  assert.deepEqual(input.getSnapshot(), { mode: "keyboard", hoverEnabled: false });
  capability(false);
  assert.deepEqual(input.getSnapshot(), { mode: "keyboard", hoverEnabled: false });
  pointer("touch", "pointerdown");
  assert.equal(input.getSnapshot().mode, "touch");
  capability(true);
  pointer("mouse", "pointerdown");
  assert.equal(input.getSnapshot().hoverEnabled, false, "a click alone does not start a hover preview");
  pointer("mouse", "pointermove");
  pointer("");
  assert.deepEqual(input.getSnapshot(), { mode: "none", hoverEnabled: false });
  disconnect();
});

test("blur, hidden documents and bfcache navigation reset hover without restoring stale state", () => {
  const { input, browser, document, pointer, disconnect } = fixture();
  for (const type of ["blur", "pagehide", "pageshow"]) {
    pointer("mouse");
    browser.dispatchEvent(new Event(type));
    assert.deepEqual(input.getSnapshot(), { mode: "none", hoverEnabled: false });
    browser.dispatchEvent(new Event("focus"));
    assert.equal(input.getSnapshot().hoverEnabled, false);
  }
  pointer("mouse");
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(input.getSnapshot().hoverEnabled, false);
  disconnect();
});

test("subscribers see updated DOM, unchanged moves do not publish, and teardown removes listeners", () => {
  const { input, document, pointer, capability, connect, disconnect } = fixture();
  let changes = 0;
  const unsubscribe = input.subscribe(() => {
    changes++;
    assert.equal(document.documentElement.dataset.hoverEnabled, String(input.getSnapshot().hoverEnabled));
    assert.equal(document.documentElement.dataset.inputMode, input.getSnapshot().mode);
  });
  pointer("mouse");
  const snapshot = input.getSnapshot();
  for (let i = 0; i < 10; i++) pointer("mouse", "pointermove");
  assert.equal(changes, 1);
  assert.equal(input.getSnapshot(), snapshot);
  disconnect();
  const afterDisconnect = changes;
  pointer("mouse");
  capability(false);
  capability(true);
  document.dispatchEvent(new Event("keydown"));
  assert.equal(changes, afterDisconnect);
  const disconnectAgain = connect();
  pointer("mouse");
  assert.equal(changes, afterDisconnect + 1);
  unsubscribe();
  disconnectAgain();
  assert.equal(changes, afterDisconnect + 1);
});
