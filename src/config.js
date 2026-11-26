const CONFIG_KEY = 'ytaf-configuration';

/**
 * Every option: its default, `desc` (the label in the settings panel) and
 * `hint` (one short sentence shown under the label).
 */
const configOptions = new Map([
  [
    'enableAdBlock',
    {
      default: true,
      desc: 'Block ads',
      hint: 'Removes video ads and sponsored tiles from your feeds.'
    }
  ],
  [
    'upgradeThumbnails',
    {
      default: false,
      desc: 'Sharper thumbnails',
      hint: 'Loads higher resolution thumbnails. Uses a little more data.'
    }
  ],
  [
    'removeShorts',
    {
      default: false,
      desc: 'Remove Shorts',
      hint: 'Removes Shorts from your feeds and the Shorts entry from the side menu.'
    }
  ],
  [
    'enableSponsorBlock',
    {
      default: true,
      desc: 'Enable SponsorBlock',
      hint: 'Skips the parts of videos that SponsorBlock users have marked.'
    }
  ],
  [
    'enableSponsorBlockSponsor',
    {
      default: true,
      desc: 'Sponsors',
      hint: 'Paid promotions and advertisements inside the video.'
    }
  ],
  [
    'enableSponsorBlockIntro',
    {
      default: true,
      desc: 'Intros',
      hint: 'Intro animations and intermissions with no actual content.'
    }
  ],
  [
    'enableSponsorBlockOutro',
    {
      default: true,
      desc: 'Outros',
      hint: 'End cards and credits.'
    }
  ],
  [
    'enableSponsorBlockInteraction',
    {
      default: true,
      desc: 'Interaction reminders',
      hint: 'Reminders to like, subscribe or follow.'
    }
  ],
  [
    'enableSponsorBlockSelfPromo',
    {
      default: true,
      desc: 'Self promotion',
      hint: "Unpaid plugs for merch, donations or the creator's other channels."
    }
  ],
  [
    'enableSponsorBlockMusicOfftopic',
    {
      default: true,
      desc: 'Non-music in music videos',
      hint: 'Talking and other non-music parts of music videos.'
    }
  ],
  [
    'enableSponsorBlockPreview',
    {
      default: false,
      desc: 'Recaps and previews',
      hint: 'Recaps of earlier episodes and previews of what is coming.'
    }
  ],
  [
    'hideLogo',
    {
      default: false,
      desc: 'Hide YouTube logo',
      hint: 'Removes the logo from the top-right corner.'
    }
  ],
  [
    'showWatch',
    {
      default: false,
      desc: 'Show clock',
      hint: 'Shows the time in the top-right corner, except over a playing video.'
    }
  ],
  [
    'keepWatchPinned',
    {
      default: false,
      desc: 'Always show clock',
      hint: 'Keeps the clock on screen during playback too.'
    }
  ],
  [
    'forceHighResVideo',
    {
      default: false,
      desc: 'Force max resolution',
      hint: 'Always plays the highest quality available instead of letting YouTube choose.'
    }
  ],
  [
    'forceVp9Codec',
    {
      default: false,
      desc: 'Prefer VP9 codec',
      hint: 'Plays VP9 instead of AV1. Try it if videos stutter on your TV.'
    }
  ],
  [
    'removeEndscreen',
    {
      default: false,
      desc: 'Remove end screens',
      hint: 'Hides the video suggestions shown over the last seconds of a video.'
    }
  ],
  [
    'disableYouThere',
    {
      default: true,
      desc: 'Disable "Continue watching?"',
      hint: 'Stops YouTube from pausing to ask whether you are still watching.'
    }
  ],
  [
    'autoAccountSelect',
    {
      default: false,
      desc: 'Skip account selection',
      hint: 'Goes straight to your account instead of the "Who\'s watching?" screen at startup.'
    }
  ],
  [
    'blockWebosCast',
    {
      default: true,
      desc: 'Block webOS Cast service',
      hint: "Stops LG's built-in Chromecast overlay from interfering. Casting from a phone still works."
    }
  ],
  [
    'forceEnglishSubtitles',
    {
      default: false,
      desc: 'English subtitles for any video',
      hint: 'Adds a machine-translated English track when captions exist only in another language.'
    }
  ],
  [
    'enableLiveCatchup',
    {
      default: false,
      desc: 'Live catch-up',
      hint: 'Skips ahead when a live stream falls behind, to stay close to real time.'
    }
  ],
  [
    'removeQrCodes',
    {
      default: true,
      desc: 'Hide QR codes',
      hint: 'Removes the shopping QR codes shown over some videos.'
    }
  ],
  [
    'hideSignInPrompts',
    {
      default: true,
      desc: 'Hide sign-in prompts',
      hint: 'When watching as a guest, removes the "Sign in" banners and tiles.'
    }
  ],
  [
    'removeMostRelevant',
    {
      default: false,
      desc: 'Hide "Most relevant" row',
      hint: 'Removes that row from the top of Subscriptions. English YouTube UI only.'
    }
  ],
  [
    'checkForUpdates',
    {
      default: true,
      desc: 'Check for updates',
      hint: 'Once a day, checks Homebrew Channel for a new version of this app.'
    }
  ]
]);

const defaultConfig = (() => {
  let ret = {};
  for (const [k, v] of configOptions) {
    ret[k] = v.default;
  }
  return ret;
})();

/** @type {Record<string, DocumentFragment>} as const */
const configFrags = (() => {
  let ret = {};
  for (const k of configOptions.keys()) {
    ret[k] = new DocumentFragment();
  }
  return ret;
})();

function loadStoredConfig() {
  const storage = window.localStorage.getItem(CONFIG_KEY);

  if (storage === null) {
    console.info('Config not set; using defaults.');
    return null;
  }

  try {
    return JSON.parse(storage);
  } catch (err) {
    console.warn('Error parsing stored config:', err);
    return null;
  }
}

// Use defaultConfig as a prototype so writes to localConfig don't change it.
let localConfig = loadStoredConfig() ?? Object.create(defaultConfig);

function configExists(key) {
  return configOptions.has(key);
}

/** @returns {string[]} Every config key, in declaration order. */
export function configKeys() {
  return Array.from(configOptions.keys());
}

export function configGetDesc(key) {
  if (!configExists(key)) {
    throw new Error('tried to get desc for unknown config key: ' + key);
  }

  return configOptions.get(key).desc;
}

/** @returns {string} The one-sentence explanation shown under the label. */
export function configGetHint(key) {
  if (!configExists(key)) {
    throw new Error('tried to get hint for unknown config key: ' + key);
  }

  return configOptions.get(key).hint ?? '';
}

export function configRead(key) {
  if (!configExists(key)) {
    throw new Error('tried to read unknown config key: ' + key);
  }

  if (localConfig[key] === undefined) {
    console.warn(
      'Populating key',
      key,
      'with default value',
      defaultConfig[key]
    );

    localConfig[key] = defaultConfig[key];
  }

  return localConfig[key];
}

export function configWrite(key, value) {
  if (!configExists(key)) {
    throw new Error('tried to write unknown config key: ' + key);
  }

  const oldValue =
    localConfig[key] !== undefined ? localConfig[key] : defaultConfig[key];

  console.info('Changing key', key, 'from', oldValue, 'to', value);
  localConfig[key] = value;
  window.localStorage[CONFIG_KEY] = JSON.stringify(localConfig);

  configFrags[key].dispatchEvent(
    new CustomEvent('ytafConfigChange', {
      detail: { key, newValue: value, oldValue }
    })
  );
}

/**
 * Add a listener for changes in the value of a specified config option
 * @param {string} key Config option to monitor
 * @param {(evt: Event) => void} callback Function to be called on change
 */
export function configAddChangeListener(key, callback) {
  const frag = configFrags[key];

  frag.addEventListener('ytafConfigChange', callback);
}

/**
 * Remove a listener for changes in the value of a specified config option
 * @param {string} key Config option to monitor
 * @param {(evt: Event) => void} callback Function to be called on change
 */
export function configRemoveChangeListener(key, callback) {
  const frag = configFrags[key];

  frag.removeEventListener('ytafConfigChange', callback);
}
