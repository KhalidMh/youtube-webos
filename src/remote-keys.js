/**
 * The remote's color buttons. A button with a handler is taken from YouTube
 * on every key event: YouTube translates a press into a second event, so
 * otherwise a single press could, e.g., toggle the settings panel open and
 * closed.
 */

const KEY_COLORS = new Map([
  [403, 'red'],

  [404, 'green'],
  [172, 'green'],

  [405, 'yellow'],
  [170, 'yellow'],

  [406, 'blue'],
  [167, 'blue'],
  [191, 'blue']
]);

/** @type {Map<string, () => void>} */
const handlers = new Map();

/**
 * Calls `handler` on each press of a color button.
 * @param {'red' | 'green' | 'yellow' | 'blue'} color
 * @param {() => void} handler
 */
export function onColorKey(color, handler) {
  if (handlers.has(color)) throw new Error(`${color} key is already taken`);
  handlers.set(color, handler);
}

/** @param {KeyboardEvent} evt */
function handleKey(evt) {
  const color = KEY_COLORS.get(evt.keyCode) ?? KEY_COLORS.get(evt.charCode);
  const handler = color && handlers.get(color);
  if (!handler) return;

  evt.preventDefault();
  evt.stopImmediatePropagation();
  if (evt.type === 'keydown') handler();
}

window.addEventListener('keydown', handleKey, true);
window.addEventListener('keypress', handleKey, true);
window.addEventListener('keyup', handleKey, true);
