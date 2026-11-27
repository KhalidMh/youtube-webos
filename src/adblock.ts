/**
 * The ads in responses are removed by `response-filters.js`. This asks for
 * none in the first place: player requests get `isInlinePlaybackNoAd`.
 */

import { configRead } from './config';

function isPrimitive(
  value: unknown
): value is string | number | boolean | null | undefined | symbol | bigint {
  return Object(value) !== value;
}

/**
 * Returns a copy of `value` with `isInlinePlaybackNoAd` set, or `value` itself
 * if it has no playback context.
 *
 * Only the objects along the path are shallow-copied, since the originals may
 * be frozen. A deep `structuredClone` is not used because it throws on values
 * `JSON.stringify` accepts (functions, symbols, `toJSON` methods, ...), which
 * would break the player request and leave the video stuck loading.
 */
function withNoAdContext(value: object): object {
  const playbackContext = (value as { playbackContext?: unknown })
    .playbackContext;
  if (isPrimitive(playbackContext)) return value;

  const ctx = (playbackContext as Record<string, unknown>)
    .contentPlaybackContext;
  if (isPrimitive(ctx)) return value;

  console.info('[adblock] Set isInlinePlaybackNoAd');

  return {
    ...value,
    playbackContext: {
      ...playbackContext,
      contentPlaybackContext: { ...ctx, isInlinePlaybackNoAd: true }
    }
  };
}

const originalStringify = JSON.stringify;

JSON.stringify = function (
  value: unknown,
  replacer?:
    | ((this: any, key: string, value: any) => any)
    | (string | number)[]
    | null,
  space?: string | number
): string {
  if (!isPrimitive(value) && configRead('enableAdBlock')) {
    try {
      value = withNoAdContext(value);
    } catch (err) {
      console.warn('[adblock] Failed to patch playback context', err);
    }
  }

  return originalStringify(value, replacer as never, space);
};
