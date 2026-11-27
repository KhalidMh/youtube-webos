import { SPONSORBLOCK_CATEGORIES } from './sponsorblock-categories.js';

const CONFIG_KEY = 'ytaf-configuration';

/**
 * @typedef {object} ConfigOption
 * @property {string} key
 * @property {boolean} default
 * @property {string} desc The label in the settings panel.
 * @property {string} hint One short sentence shown under the label.
 * @property {ConfigOption[]} [children] Options that only apply while this
 *   one is on, shown nested under it.
 *
 * @typedef {object} ConfigSection
 * @property {string} title
 * @property {string} [note] Shown at the end of the section.
 * @property {ConfigOption[]} options
 */

/**
 * Every option, in the settings panel's layout: one tab per section.
 * @type {ConfigSection[]}
 */
export const CONFIG_SECTIONS = [
  {
    title: 'Content',
    options: [
      {
        key: 'enableAdBlock',
        default: true,
        desc: 'Block ads',
        hint: 'Removes video ads and sponsored tiles from your feeds.'
      },
      {
        key: 'removeQrCodes',
        default: true,
        desc: 'Hide QR codes',
        hint: 'Removes the shopping QR codes shown over some videos.'
      },
      {
        key: 'hideSignInPrompts',
        default: true,
        desc: 'Hide sign-in prompts',
        hint: 'When watching as a guest, removes the "Sign in" banners and tiles.'
      },
      {
        key: 'removeShorts',
        default: false,
        desc: 'Remove Shorts',
        hint: 'Removes Shorts from your feeds and the Shorts entry from the side menu.'
      },
      {
        key: 'removeMostRelevant',
        default: false,
        desc: 'Hide "Most relevant" row',
        hint: 'Removes that row from the top of Subscriptions. English YouTube UI only.'
      },
      {
        key: 'removeEndscreen',
        default: false,
        desc: 'Remove end screens',
        hint: 'Hides the video suggestions shown over the last seconds of a video.'
      },
      {
        key: 'upgradeThumbnails',
        default: false,
        desc: 'Sharper thumbnails',
        hint: 'Loads higher resolution thumbnails. Uses a little more data.'
      }
    ]
  },
  {
    title: 'Playback',
    options: [
      {
        key: 'forceHighResVideo',
        default: false,
        desc: 'Force max resolution',
        hint: 'Always plays the highest quality available instead of letting YouTube choose.'
      },
      {
        key: 'forceVp9Codec',
        default: false,
        desc: 'Prefer VP9 codec',
        hint: 'Plays VP9 instead of AV1. Try it if videos stutter on your TV.'
      },
      {
        key: 'disableYouThere',
        default: true,
        desc: 'Disable "Continue watching?"',
        hint: 'Stops YouTube from pausing to ask whether you are still watching.'
      },
      {
        key: 'enableLiveCatchup',
        default: false,
        desc: 'Live catch-up',
        hint: 'Skips ahead when a live stream falls behind, to stay close to real time.'
      },
      {
        key: 'forceEnglishSubtitles',
        default: false,
        desc: 'English subtitles for any video',
        hint: 'Adds a machine-translated English track when captions exist only in another language.'
      }
    ]
  },
  {
    title: 'SponsorBlock',
    note: 'Segments are submitted by the SponsorBlock community (sponsor.ajay.app).',
    options: [
      {
        key: 'enableSponsorBlock',
        default: true,
        desc: 'Enable SponsorBlock',
        hint: 'Skips the parts of videos that SponsorBlock users have marked.',
        children: SPONSORBLOCK_CATEGORIES.map((category) => category.option)
      }
    ]
  },
  {
    title: 'Interface',
    options: [
      {
        key: 'hideLogo',
        default: false,
        desc: 'Hide YouTube logo',
        hint: 'Removes the logo from the top-right corner.'
      },
      {
        key: 'showWatch',
        default: false,
        desc: 'Show clock',
        hint: 'Shows the time in the top-right corner, except over a playing video.'
      },
      {
        key: 'keepWatchPinned',
        default: false,
        desc: 'Always show clock',
        hint: 'Keeps the clock on screen during playback too.'
      },
      {
        key: 'autoAccountSelect',
        default: false,
        desc: 'Skip account selection',
        hint: 'Goes straight to your account instead of the "Who\'s watching?" screen at startup.'
      },
      {
        key: 'blockWebosCast',
        default: true,
        desc: 'Block webOS Cast service',
        hint: "Stops LG's built-in Chromecast overlay from interfering. Casting from a phone still works."
      },
      {
        key: 'checkForUpdates',
        default: true,
        desc: 'Check for updates',
        hint: 'Once a day, checks Homebrew Channel for a new version of this app.'
      }
    ]
  }
];

/** @type {Map<string, ConfigOption>} */
const configOptions = new Map();
/** @param {ConfigOption[]} options */
function addOptions(options) {
  for (const option of options) {
    configOptions.set(option.key, option);
    addOptions(option.children ?? []);
  }
}
for (const section of CONFIG_SECTIONS) addOptions(section.options);

/** Change events, one event type per option key. */
const changeEvents = document.createDocumentFragment();

/** @returns {Record<string, unknown>} The values the user has set. */
function loadStoredConfig() {
  const storage = window.localStorage.getItem(CONFIG_KEY);

  if (storage === null) {
    console.info('Config not set; using defaults.');
    return {};
  }

  try {
    return JSON.parse(storage) ?? {};
  } catch (err) {
    console.warn('Error parsing stored config:', err);
    return {};
  }
}

const storedConfig = loadStoredConfig();

/** @param {string} key */
function getOption(key) {
  const option = configOptions.get(key);
  if (!option) throw new Error('unknown config key: ' + key);
  return option;
}

/** @param {string} key */
export function configRead(key) {
  const option = getOption(key);
  return Object.hasOwn(storedConfig, key) ? storedConfig[key] : option.default;
}

/**
 * @param {string} key
 * @param {boolean} value
 */
export function configWrite(key, value) {
  const oldValue = configRead(key);

  console.info('Changing key', key, 'from', oldValue, 'to', value);
  storedConfig[key] = value;
  window.localStorage[CONFIG_KEY] = JSON.stringify(storedConfig);

  changeEvents.dispatchEvent(new CustomEvent(key, { detail: value }));
}

/**
 * Calls `callback` with the new value whenever an option changes.
 * @param {string} key
 * @param {(newValue: boolean) => void} callback
 */
export function configAddChangeListener(key, callback) {
  getOption(key);
  changeEvents.addEventListener(key, (evt) => {
    callback(/** @type {CustomEvent<boolean>} */ (evt).detail);
  });
}
