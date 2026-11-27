/**
 * Removes unwanted content from parsed InnerTube responses, in place. Each
 * rule is switched on by the config option it names:
 *
 * - `enableAdBlock`: ad placements of the player, the home screen's masthead
 *   and ad tiles, and ads between Shorts. A minimal reimplementation of
 *   https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt
 * - `removeShorts`: Shorts tiles and shelves, and the Shorts entry of the
 *   side menu.
 * - `removeQrCodes`: the product/merch QR codes shown over the player (#385),
 *   `playerOverlays.playerOverlayRenderer.timelyActionRenderers` in the player
 *   and next responses.
 * - `hideSignInPrompts`: sign-in prompts shown to guests (#359): feed nudges,
 *   alerts and the "Sign in for better recommendations" tile.
 * - `removeMostRelevant`: the "Most relevant" shelf on the subscriptions page
 *   (#376). It is matched by its title, so this only works with the English UI.
 * - `removeEndscreen`: the video suggestions shown over the end of a video.
 *
 * Items are dropped from the data rather than hidden with CSS: a hidden
 * element keeps its place in YouTube's focus model, which broke remote
 * navigation past it.
 *
 * Based in part on the filters of NicholasBly/youtube-webos (GPL-3.0).
 */

const SHORTS_SHELF = 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS';
const MOST_RELEVANT_TITLE = 'Most relevant';
const GUEST_PROMPT_TEXT = 'Sign in for better recommendations';

/** The item lists a shelf's `content` can hold, as `<renderer>.items`. */
const SHELF_LISTS = [
  'horizontalListRenderer',
  'gridRenderer',
  'expandedShelfContentsRenderer'
];

/**
 * The content feeds items are removed from, as `<renderer>.<list key>`: page
 * sections, the items of a shelf or grid, and their continuations. Lists
 * anywhere else (sign-in and account screens, settings, menus) are left
 * alone, so a prompt-like component reused there is never removed.
 */
const FEED_LISTS = new Set([
  'sectionListRenderer.contents',
  'sectionListContinuation.contents',
  ...SHELF_LISTS.map((renderer) => `${renderer}.items`),
  'gridContinuation.items',
  'horizontalListContinuation.items',
  'appendContinuationItemsAction.continuationItems',
  'reloadContinuationItemsCommand.continuationItems'
]);

const SIDE_MENU_LISTS = new Set(['guideSectionRenderer.items']);

/**
 * @typedef {'enableAdBlock' | 'removeShorts' | 'removeQrCodes' | 'hideSignInPrompts' | 'removeMostRelevant' | 'removeEndscreen'} FilterOption
 * @typedef {Partial<Record<FilterOption, boolean>>} FilterOptions
 * @typedef {{ option: FilterOption, lists: Set<string>, drop: (item: any) => boolean }} ItemRule
 * @typedef {{ option: FilterOption, apply: (response: any) => string[] }} ResponseRule
 */

/** @param {any} title */
function textOf(title) {
  return title?.runs?.[0]?.text ?? title?.simpleText;
}

/** @param {any} shelf */
function getShelfTitle(shelf) {
  return textOf(
    shelf.title ??
      shelf.headerRenderer?.shelfHeaderRenderer?.avatarLockup
        ?.avatarLockupRenderer?.title
  );
}

/** @type {ItemRule[]} */
const ITEM_RULES = [
  {
    option: 'enableAdBlock',
    lists: FEED_LISTS,
    drop: (item) => !!(item.adSlotRenderer || item.tvMastheadRenderer)
  },
  {
    option: 'removeShorts',
    lists: FEED_LISTS,
    drop: (item) =>
      item.tileRenderer?.onSelectCommand?.reelWatchEndpoint != null ||
      item.shelfRenderer?.tvhtml5ShelfRendererType === SHORTS_SHELF
  },
  // The side menu opens a page as soon as an entry is focused, so just moving
  // past the Shorts entry loaded and buffered a Short every time.
  {
    option: 'removeShorts',
    lists: SIDE_MENU_LISTS,
    drop: (item) =>
      item.guideEntryRenderer?.navigationEndpoint?.reelWatchEndpoint != null
  },
  {
    option: 'hideSignInPrompts',
    lists: FEED_LISTS,
    drop: (item) =>
      !!(item.feedNudgeRenderer || item.alertWithActionsRenderer) ||
      textOf(item.gridButtonRenderer?.title) === GUEST_PROMPT_TEXT
  },
  {
    option: 'removeMostRelevant',
    lists: FEED_LISTS,
    drop: (item) =>
      !!item.shelfRenderer &&
      getShelfTitle(item.shelfRenderer) === MOST_RELEVANT_TITLE
  }
];

/**
 * Deletes `obj[key]` if `present(obj[key])`.
 * @param {any} obj
 * @param {string} key
 * @param {(value: any) => boolean} present
 * @returns {string[]} `[key]` if it was deleted.
 */
function deleteIf(obj, key, present) {
  if (!obj || !present(obj[key])) return [];
  delete obj[key];
  return [key];
}

/** @type {ResponseRule[]} */
const RESPONSE_RULES = [
  {
    option: 'enableAdBlock',
    apply: (response) => {
      const removed = [
        ...deleteIf(response, 'adPlacements', Boolean),
        ...deleteIf(response, 'adSlots', Array.isArray),
        ...deleteIf(response, 'playerAds', Boolean)
      ];
      if (Array.isArray(response.entries)) {
        const before = response.entries.length;
        response.entries = response.entries.filter(
          (/** @type {any} */ entry) =>
            !entry?.command?.reelWatchEndpoint?.adClientParams?.isAd
        );
        if (response.entries.length < before) removed.push('Shorts ads');
      }
      return removed;
    }
  },
  {
    option: 'removeQrCodes',
    apply: (response) =>
      deleteIf(
        response.playerOverlays?.playerOverlayRenderer,
        'timelyActionRenderers',
        Boolean
      )
  },
  {
    option: 'removeEndscreen',
    apply: (response) =>
      deleteIf(
        response,
        'endscreen',
        (value) =>
          value !== null &&
          typeof value === 'object' &&
          'endscreenRenderer' in value
      )
  }
];

/** Every config option a rule reads. */
export const FILTER_OPTIONS = /** @type {FilterOption[]} */ ([
  ...new Set([...ITEM_RULES, ...RESPONSE_RULES].map((rule) => rule.option))
]);

/**
 * Walks `node`, removing the items the rules drop from the lists they apply
 * to. A shelf this emptied goes too: left in place, the app renders its header
 * and placeholder tiles, waiting for content that is gone.
 * @param {unknown} node
 * @param {Map<string, ItemRule[]>} rulesByList
 * @param {string} key The key `node` sits under in its parent.
 * @param {string} parentKey The key the parent sits under in its own parent.
 * @returns {number} How many items were removed.
 */
function filterTree(node, rulesByList, key, parentKey) {
  if (node === null || typeof node !== 'object') return 0;

  let removed = 0;

  if (Array.isArray(node)) {
    const rules = rulesByList.get(`${parentKey}.${key}`);
    let writeIdx = 0;
    for (let i = 0; i < node.length; i++) {
      const item = node[i];
      let keep = !(
        rules &&
        item !== null &&
        typeof item === 'object' &&
        rules.some((rule) => rule.drop(item))
      );

      if (keep) {
        const shelf = item?.shelfRenderer;
        const before = shelf ? countShelfItems(shelf) : 0;
        const removedInside = filterTree(item, rulesByList, '', key);
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
  for (const childKey in obj) {
    removed += filterTree(obj[childKey], rulesByList, childKey, key);
  }
  return removed;
}

/** @param {any} shelf */
function countShelfItems(shelf) {
  return SHELF_LISTS.map((renderer) => shelf.content?.[renderer]?.items)
    .filter(Array.isArray)
    .reduce((sum, list) => sum + list.length, 0);
}

/**
 * Removes the content the options ask for from a parsed response, in place.
 * @param {unknown} response
 * @param {FilterOptions} options
 * @returns {{ fields: string[], items: number }} What was removed: whole
 *   fields by name, and how many list items.
 */
export function filterResponse(response, options) {
  const result = { fields: /** @type {string[]} */ ([]), items: 0 };
  if (response === null || typeof response !== 'object') return result;

  for (const rule of RESPONSE_RULES) {
    if (options[rule.option]) result.fields.push(...rule.apply(response));
  }

  /** @type {Map<string, ItemRule[]>} */
  const rulesByList = new Map();
  for (const rule of ITEM_RULES) {
    if (!options[rule.option]) continue;
    for (const list of rule.lists) {
      rulesByList.set(list, [...(rulesByList.get(list) ?? []), rule]);
    }
  }

  // A player response (`streamingData`) has no lists of these, and walking its
  // streaming data at every video start would be wasted work.
  if (rulesByList.size > 0 && !('streamingData' in response)) {
    result.items = filterTree(response, rulesByList, '', '');
  }

  return result;
}
