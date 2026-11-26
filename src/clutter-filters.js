/**
 * Removes on-screen clutter from parsed InnerTube responses, in place:
 *
 * - The product/merch QR codes shown over the player (#385): they come as
 *   `playerOverlays.playerOverlayRenderer.timelyActionRenderers` in the player
 *   and next responses.
 * - Sign-in prompts shown to guests (#359): feed nudges, alerts and the
 *   "Sign in for better recommendations" tile, in home, search, browse and
 *   watch-next lists. They are dropped from the data rather than hidden with
 *   CSS: a hidden element keeps its place in YouTube's focus model, which
 *   broke remote navigation past it.
 * - The "Most relevant" shelf on the subscriptions page (#376). It is matched
 *   by its title, so this only works with the English UI.
 *
 * Based on the filters of NicholasBly/youtube-webos (GPL-3.0).
 *
 * Kept free of browser and config dependencies so it can be unit tested
 * (tests/clutter-filters.test.js).
 */

const MOST_RELEVANT_TITLE = 'Most relevant';
const GUEST_PROMPT_TEXT = 'Sign in for better recommendations';

// Generous for InnerTube trees (shelves sit about 15 levels deep), and keeps a
// malformed or cyclic value from recursing forever.
const MAX_DEPTH = 40;

/**
 * @typedef {object} ClutterOptions
 * @property {boolean} removeQrCodes
 * @property {boolean} hideSignInPrompts
 * @property {boolean} removeMostRelevant
 */

/** @param {any} shelf */
function getShelfTitle(shelf) {
  const title =
    shelf?.title ??
    shelf?.headerRenderer?.shelfHeaderRenderer?.avatarLockup
      ?.avatarLockupRenderer?.title;
  return title?.runs?.[0]?.text ?? title?.simpleText ?? '';
}

/** @param {any} item */
function isGuestPrompt(item) {
  if (item.feedNudgeRenderer || item.alertWithActionsRenderer) return true;
  const title = item.gridButtonRenderer?.title;
  const text = title?.runs?.[0]?.text ?? title?.simpleText;
  return text === GUEST_PROMPT_TEXT;
}

/**
 * The item lists of a shelf, as the TV app nests them.
 * @param {any} shelf
 * @returns {unknown[][]}
 */
function shelfItemLists(shelf) {
  const content = shelf?.content;
  return [
    content?.horizontalListRenderer?.items,
    content?.gridRenderer?.items,
    content?.expandedShelfContentsRenderer?.items
  ].filter(Array.isArray);
}

/** @param {any} shelf */
function countShelfItems(shelf) {
  return shelfItemLists(shelf).reduce((sum, list) => sum + list.length, 0);
}

/**
 * @param {any} item
 * @param {ClutterOptions} options
 */
function shouldDrop(item, options) {
  if (item === null || typeof item !== 'object') return false;
  if (options.hideSignInPrompts && isGuestPrompt(item)) return true;
  return (
    options.removeMostRelevant &&
    !!item.shelfRenderer &&
    getShelfTitle(item.shelfRenderer) === MOST_RELEVANT_TITLE
  );
}

/**
 * Walks `node`, removing the matching items from every array it holds.
 * A shelf this emptied goes too: left in place, the app renders its header and
 * placeholder tiles, waiting for content that is gone.
 * @param {unknown} node
 * @param {ClutterOptions} options
 * @param {number} depth
 * @returns {number} How many items were removed.
 */
function filterTree(node, options, depth) {
  if (node === null || typeof node !== 'object' || depth > MAX_DEPTH) return 0;

  let removed = 0;

  if (Array.isArray(node)) {
    let writeIdx = 0;
    for (let i = 0; i < node.length; i++) {
      const item = node[i];
      let keep = !shouldDrop(item, options);

      if (keep) {
        const shelf = /** @type {any} */ (item)?.shelfRenderer;
        const before = shelf ? countShelfItems(shelf) : 0;
        const removedInside = filterTree(item, options, depth + 1);
        removed += removedInside;
        if (shelf && removedInside > 0 && before > 0) {
          keep = countShelfItems(shelf) > 0;
        }
      }

      if (keep) {
        node[writeIdx++] = item;
      } else {
        removed++;
      }
    }
    node.length = writeIdx;
    return removed;
  }

  const obj = /** @type {Record<string, unknown>} */ (node);
  for (const key in obj) {
    removed += filterTree(obj[key], options, depth + 1);
  }
  return removed;
}

/**
 * @param {any} response
 * @returns {boolean} Whether a QR code overlay was removed.
 */
function removeQrCodes(response) {
  const overlay = response?.playerOverlays?.playerOverlayRenderer;
  if (!overlay?.timelyActionRenderers) return false;
  delete overlay.timelyActionRenderers;
  return true;
}

/**
 * Removes the clutter the options ask for from a parsed InnerTube response,
 * in place.
 * @param {unknown} response
 * @param {ClutterOptions} options
 * @returns {{ qrCodes: boolean, items: number }} What was removed.
 */
export function removeClutter(response, options) {
  const result = { qrCodes: false, items: 0 };
  if (response === null || typeof response !== 'object') return result;

  if (options.removeQrCodes) result.qrCodes = removeQrCodes(response);

  // A player response (`streamingData`) has no lists of these, and walking its
  // streaming data at every video start would be wasted work.
  if (
    (options.hideSignInPrompts || options.removeMostRelevant) &&
    !('streamingData' in response)
  ) {
    result.items = filterTree(response, options, 0);
  }

  return result;
}
