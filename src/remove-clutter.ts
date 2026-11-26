import { removeClutter as removeClutterWith } from './clutter-filters.js';
import { configRead } from './config';

/**
 * Removes the clutter enabled in the config from a parsed InnerTube response,
 * in place. Also used by `early-browse.ts`, for a response parsed before this
 * hook.
 */
export function removeClutter(response: unknown) {
  // Only InnerTube responses: JSON.parse also sees the app's own small values.
  if (
    (response as { responseContext?: unknown } | null)?.responseContext == null
  )
    return;

  const { qrCodes, items } = removeClutterWith(response, {
    removeQrCodes: configRead('removeQrCodes'),
    hideSignInPrompts: configRead('hideSignInPrompts'),
    removeMostRelevant: configRead('removeMostRelevant')
  });

  if (qrCodes) console.info('[remove-clutter] Removed QR code overlay');
  if (items > 0) console.info(`[remove-clutter] Removed ${items} items`);
}

const origParse = JSON.parse;
JSON.parse = function (text, reviver) {
  const r: unknown = origParse.call(JSON, text, reviver);
  try {
    removeClutter(r);
  } catch (err) {
    console.warn('[remove-clutter] Failed to filter response', err);
  }
  return r;
};
