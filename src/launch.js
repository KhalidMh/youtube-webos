const CONTENT_INTENT_REGEX = /^.+(?=Content)/g;

export function extractLaunchParams() {
  if (window.launchParams) {
    return JSON.parse(window.launchParams);
  } else {
    return {};
  }
}

function getYTURL() {
  const ytURL = new URL('https://www.youtube.com/tv#/');
  ytURL.searchParams.append('env_forceFullAnimation', '1');
  ytURL.searchParams.append('env_enableWebSpeech', '1');
  ytURL.searchParams.append('env_enableVoice', '1');
  return ytURL;
}

// Require HTTPS as well as the origin: blob URLs can share an HTTPS origin.
function parseAllowedYouTubeURL(value, origin) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === origin ? url : null;
  } catch {
    return null;
  }
}

/**
 * @param {URLSearchParams} a
 * @param {URLSearchParams} b
 */
function concatSearchParams(a, b) {
  return new URLSearchParams([...a.entries(), ...b.entries()]);
}

/**
 * What the launch asks to open: a URL or query string, a voice intent object,
 * or nothing.
 *
 * Our custom `target` param is used, since launches with `contentTarget` do
 * not respect the `handlesRelaunch` appinfo option; an explicit
 * `contentTarget` still takes precedence.
 * @param {Record<string, unknown>} params webOS launch params
 */
export function getContentTarget(params) {
  const { target, contentTarget = target } = params;
  return contentTarget;
}

// `dialLaunch`/`pairingCode` mark a DIAL launch, `cc2` a Cast Connect one.
const CAST_LAUNCH_PARAMS = ['dialLaunch', 'pairingCode', 'cc2'];

/** @param {string} query A URL's query string, with or without the `?`. */
export function hasCastParams(query) {
  const params = new URLSearchParams(query);
  return CAST_LAUNCH_PARAMS.some((key) => params.has(key));
}

/**
 * Whether the launch comes from a phone casting to the TV.
 * @param {Record<string, unknown>} params webOS launch params
 */
export function isCastLaunch(params) {
  const contentTarget = getContentTarget(params);
  if (typeof contentTarget !== 'string') return false;

  const queryStart = contentTarget.indexOf('?');
  return hasCastParams(
    queryStart === -1 ? contentTarget : contentTarget.slice(queryStart + 1)
  );
}

export function handleLaunch(params) {
  console.info('handleLaunch', params);
  let ytURL = getYTURL();

  let contentTarget = getContentTarget(params);

  switch (typeof contentTarget) {
    case 'string': {
      const directURL = parseAllowedYouTubeURL(contentTarget, ytURL.origin);
      if (directURL) {
        console.info('Launching from direct contentTarget');
        ytURL = directURL;
      } else {
        // Out of app dial launch with second screen on home: { contentTarget: 'pairingCode=<UUID>&theme=cl&dialLaunch=watch' }
        console.info('Launching from partial contentTarget');
        // Google Assistant: { contentTarget: 'v=v=<ID>', storeCaller: 'voice', subReason: 'voiceAgent', voiceEngine: 'googleAssistant' }
        if (contentTarget.indexOf('v=v=') === 0)
          contentTarget = contentTarget.substring(2);

        ytURL.search = concatSearchParams(
          ytURL.searchParams,
          new URLSearchParams(contentTarget)
        );
      }
      break;
    }
    case 'object': {
      console.info('Voice launch');

      const { intent, intentParam } = contentTarget;
      // Ctrl+F tvhtml5LaunchUrlComponentChanged & REQUEST_ORIGIN_GOOGLE_ASSISTANT in base.js for info
      const search = ytURL.searchParams;
      // contentTarget.intent's seen so far: PlayContent, SearchContent
      const voiceContentIntent = intent
        .match(CONTENT_INTENT_REGEX)?.[0]
        ?.toLowerCase();

      search.set('inApp', true);
      search.set('vs', 9); // Voice System is VOICE_SYSTEM_LG_THINKQ
      voiceContentIntent && search.set('va', voiceContentIntent);

      // order is important
      search.append('launch', 'voice');
      voiceContentIntent === 'search' && search.append('launch', 'search');

      search.set('vq', intentParam);
      break;
    }
    default: {
      console.info('Default launch');
    }
  }

  window.location.href = ytURL.toString();
}
