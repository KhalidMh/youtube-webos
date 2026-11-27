/**
 * Every InnerTube response (an object with `responseContext`) parsed with
 * `JSON.parse` goes through the filters registered here, in registration
 * order. Filters edit the response in place; one that throws is skipped, so
 * YouTube still gets its response. Other parsed values (the app's own
 * storage, other APIs' responses) are left alone.
 *
 * YouTube's page also fetches the home screen in an inline script that runs
 * before webOS injects the user script (about 3 s after the page starts):
 * `window.pendingEarlyBrowse` resolves about 2.5 s in, parsed with the native
 * `JSON.parse`, and the app takes the response about 4 s in. The same filters
 * are applied to it here. Only fresh starts fetch it: a preloaded launch
 * (`launch=preload`) skips it (#370).
 */

type ResponseFilter = (response: object) => void;

const filters: { name: string; filter: ResponseFilter }[] = [];

/**
 * Register at module top level, before any `await`: the early home screen is
 * filtered as soon as the user script has evaluated, by the filters
 * registered by then.
 * @param name Prefix for the warning logged when the filter throws.
 */
export function addResponseFilter(name: string, filter: ResponseFilter) {
  filters.push({ name, filter });
}

function filterResponse(value: unknown) {
  if (value === null || typeof value !== 'object') return;
  if (!('responseContext' in value)) return;
  for (const { name, filter } of filters) {
    try {
      filter(value);
    } catch (err) {
      console.warn(`[${name}] Failed to filter response`, err);
    }
  }
}

const originalParse = JSON.parse;
JSON.parse = function (
  text: string,
  reviver?: Parameters<typeof JSON.parse>[1]
) {
  const value: unknown = originalParse.call(JSON, text, reviver);
  filterResponse(value);
  return value;
};

// A `then` callback never runs synchronously, so it runs after the user
// script has evaluated and every module has registered its filter.
window.pendingEarlyBrowse?.then(
  (early) => {
    if (!early?.response) return;
    filterResponse(early.response);
    console.info('[json-parse] Filtered the early home screen');
  },
  // The page handles its own failure
  () => {}
);
