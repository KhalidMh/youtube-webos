/*global __YTAF_VERSION__*/
import './spatial-navigation-polyfill.js';
import {
  configAddChangeListener,
  configRead,
  configWrite,
  configGetDesc,
  configKeys
} from './config.js';
import './ui.css';
import { requireElement } from './player_api/helpers';

// We handle key events ourselves.
window.__spatialNavigation__.keyMode = 'NONE';

const ARROW_KEY_CODE = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

const colorCodeMap = new Map([
  [403, 'red'],

  [404, 'green'],
  [172, 'green'],

  [405, 'yellow'],
  [170, 'yellow'],

  [406, 'blue'],
  [167, 'blue'],
  [191, 'blue']
]);

/**
 * Returns the name of the color button associated with a code or null if not a color button.
 * @param {KeyboardEvent} evt Remote keyboard event
 * @returns {string | null} Color name or null
 */
function getKeyColor(evt) {
  return (
    colorCodeMap.get(evt.keyCode) ?? colorCodeMap.get(evt.charCode) ?? null
  );
}

function createConfigCheckbox(key) {
  const elmInput = document.createElement('input');
  elmInput.type = 'checkbox';
  elmInput.checked = configRead(key);

  /** @type {(evt: Event) => void} */
  const changeHandler = (evt) => {
    configWrite(key, evt.target.checked);
  };

  elmInput.addEventListener('change', changeHandler);

  configAddChangeListener(key, (evt) => {
    elmInput.checked = evt.detail.newValue;
  });

  const elmLabel = document.createElement('label');
  elmLabel.appendChild(elmInput);
  // Use non-breaking space (U+00A0)
  elmLabel.appendChild(document.createTextNode('\u00A0' + configGetDesc(key)));

  return elmLabel;
}

/**
 * The settings panel layout: one tab per section. A config option missing
 * from here still shows up, in an "Other" tab, so a new option is never
 * silently left out of the panel.
 * @type {{ title: string, keys: string[], nested?: string[], note?: string }[]}
 */
const PANEL_SECTIONS = [
  {
    title: 'Content',
    keys: [
      'enableAdBlock',
      'removeQrCodes',
      'hideSignInPrompts',
      'removeShorts',
      'removeMostRelevant',
      'removeEndscreen',
      'upgradeThumbnails'
    ]
  },
  {
    title: 'Playback',
    keys: [
      'forceHighResVideo',
      'forceVp9Codec',
      'disableYouThere',
      'enableLiveCatchup',
      'forceEnglishSubtitles'
    ]
  },
  {
    title: 'SponsorBlock',
    keys: ['enableSponsorBlock'],
    nested: [
      'enableSponsorBlockSponsor',
      'enableSponsorBlockIntro',
      'enableSponsorBlockOutro',
      'enableSponsorBlockInteraction',
      'enableSponsorBlockSelfPromo',
      'enableSponsorBlockMusicOfftopic',
      'enableSponsorBlockPreview'
    ],
    note: 'Sponsor segments skipping - https://sponsor.ajay.app'
  },
  {
    title: 'Interface',
    keys: [
      'hideLogo',
      'showWatch',
      'keepWatchPinned',
      'autoAccountSelect',
      'blockWebosCast',
      'checkForUpdates'
    ]
  }
];

/** The layout above, minus unknown keys, plus an "Other" tab for unlisted ones. */
function resolvePanelSections() {
  const known = new Set(configKeys());
  const listed = new Set();
  const keep = (key) => {
    if (!known.has(key)) {
      console.warn('Settings panel: unknown config key', key);
      return false;
    }
    listed.add(key);
    return true;
  };

  const sections = PANEL_SECTIONS.map((section) => ({
    ...section,
    keys: section.keys.filter(keep),
    nested: (section.nested ?? []).filter(keep)
  }));

  const unlisted = configKeys().filter((key) => !listed.has(key));
  if (unlisted.length > 0) {
    sections.push({ title: 'Other', keys: unlisted, nested: [] });
  }
  return sections;
}

function createOptionsPanel() {
  const elmContainer = document.createElement('div');

  elmContainer.classList.add('ytaf-ui-container');
  elmContainer.style['display'] = 'none';
  elmContainer.setAttribute('tabindex', 0);

  const elmHeading = document.createElement('h1');
  elmHeading.textContent = 'webOS YouTube Extended';
  elmContainer.appendChild(elmHeading);

  const elmTabBar = document.createElement('div');
  elmTabBar.className = 'ytaf-ui-tabs';
  elmContainer.appendChild(elmTabBar);

  /** @type {HTMLButtonElement[]} */
  const tabButtons = [];
  /** @type {HTMLElement[]} */
  const sectionElements = [];
  let activeTab = 0;

  function selectTab(index) {
    activeTab = index;
    tabButtons.forEach((tab, i) => {
      tab.classList.toggle('ytaf-ui-tab-active', i === index);
    });
    sectionElements.forEach((section, i) => {
      section.style.display = i === index ? 'block' : 'none';
    });
    elmContainer.scrollTop = 0;
  }

  function focusActiveTab() {
    tabButtons[activeTab]?.focus();
  }

  /** The focusable controls of the visible section, in document order. */
  function sectionControls() {
    return Array.from(
      sectionElements[activeTab]?.querySelectorAll('input') ?? []
    );
  }

  resolvePanelSections().forEach((section, index) => {
    const elmTab = document.createElement('button');
    elmTab.className = 'ytaf-ui-tab';
    elmTab.textContent = section.title;
    // Moving onto a tab opens it, like YouTube's own side menu.
    elmTab.addEventListener('focus', () => selectTab(index));
    elmTab.addEventListener('click', () => selectTab(index));
    elmTabBar.appendChild(elmTab);
    tabButtons.push(elmTab);

    const elmSection = document.createElement('div');
    elmSection.className = 'ytaf-ui-section';
    for (const key of section.keys) {
      elmSection.appendChild(createConfigCheckbox(key));
    }

    if (section.nested.length > 0) {
      const elmBlock = document.createElement('blockquote');
      for (const key of section.nested) {
        elmBlock.appendChild(createConfigCheckbox(key));
      }
      elmSection.appendChild(elmBlock);
    }

    if (section.note) {
      const elmNote = document.createElement('small');
      elmNote.className = 'ytaf-ui-sponsor';
      elmNote.textContent = section.note;
      elmSection.appendChild(elmNote);
    }

    elmContainer.appendChild(elmSection);
    sectionElements.push(elmSection);
  });

  selectTab(0);

  /**
   * Arrow keys, handled here rather than by spatial navigation:
   * - Tab bar: left/right move between tabs, down enters the open section.
   * - Section: up/down move through its options in order; up from the first
   *   goes back to its own tab. Spatial navigation would pick whichever tab is
   *   nearest on screen (switching sections), and skips options scrolled out
   *   of view, so a long section could not be scrolled with the remote.
   */
  function handleArrow(direction) {
    const active = document.activeElement;
    const tabIndex = tabButtons.indexOf(active);

    if (tabIndex !== -1) {
      if (direction === 'left' || direction === 'right') {
        const step = direction === 'right' ? 1 : -1;
        const count = tabButtons.length;
        tabButtons[(tabIndex + step + count) % count].focus();
      } else if (direction === 'down') {
        sectionControls()[0]?.focus();
      }
      return;
    }

    const controls = sectionControls();
    const index = controls.indexOf(active);

    if (index === -1) {
      // The panel itself, or something outside the open section.
      focusActiveTab();
    } else if (direction === 'up') {
      if (index === 0) focusActiveTab();
      else controls[index - 1].focus();
    } else if (direction === 'down') {
      controls[index + 1]?.focus();
    }
    // Left/right inside a section: nothing to move to.
  }

  elmContainer.addEventListener(
    'keydown',
    (evt) => {
      console.debug('Options panel key event:', evt.type, evt.charCode);

      if (getKeyColor(evt) === 'green') {
        return;
      }

      if (evt.keyCode in ARROW_KEY_CODE) {
        handleArrow(ARROW_KEY_CODE[evt.keyCode]);
      } else if (evt.keyCode === 13) {
        // "OK" button

        /**
         * The YouTube app generates these "OK" events from clicks (including
         * with the Magic Remote), and we don't want to send a duplicate click
         * event for those. Youtube uses the `Event` class instead of
         * `KeyboardEvent` so we check for that.
         * See issue #143 and #200 for context.
         */
        if (evt instanceof KeyboardEvent) {
          document.activeElement.click();
        }
      } else if (evt.keyCode === 27) {
        // Back button
        showOptionsPanel(false);
      }

      evt.preventDefault();
      evt.stopPropagation();
    },
    true
  );

  const elmVersion = document.createElement('div');
  elmVersion.className = 'ytaf-ui-version';
  elmVersion.textContent = `v${__YTAF_VERSION__}`;

  const elmUpdateStatus = document.createElement('span');
  elmUpdateStatus.className = 'ytaf-ui-update-status';
  elmVersion.appendChild(elmUpdateStatus);

  elmContainer.appendChild(elmVersion);

  return { elmContainer, focusActiveTab, elmUpdateStatus };
}

const {
  elmContainer: optionsPanel,
  focusActiveTab,
  elmUpdateStatus
} = createOptionsPanel();
document.body.appendChild(optionsPanel);

/**
 * Shows the update check's result next to the version in the settings panel.
 * @param {string} text Empty to clear.
 * @param {boolean} highlight Whether an update is available.
 */
export function setUpdateStatus(text, highlight) {
  elmUpdateStatus.textContent = text ? ` · ${text}` : '';
  elmUpdateStatus.classList.toggle('ytaf-ui-update-available', highlight);
}

let optionsPanelVisible = false;

/**
 * Show or hide the options panel.
 * @param {boolean} [visible=true] Whether to show the options panel.
 */
function showOptionsPanel(visible) {
  visible ??= true;

  if (visible && !optionsPanelVisible) {
    console.debug('Showing and focusing options panel!');
    optionsPanel.style.display = 'block';
    focusActiveTab();
    optionsPanelVisible = true;
  } else if (!visible && optionsPanelVisible) {
    console.debug('Hiding options panel!');
    optionsPanel.style.display = 'none';
    optionsPanel.blur();
    optionsPanelVisible = false;
  }
}

window.ytaf_showOptionsPanel = showOptionsPanel;

const eventHandler = (evt) => {
  console.debug(
    'Key event:',
    evt.type,
    evt.charCode,
    evt.keyCode,
    evt.defaultPrevented
  );

  if (getKeyColor(evt) === 'green') {
    console.debug('Taking over!');

    evt.preventDefault();
    evt.stopImmediatePropagation();

    if (evt.type === 'keydown') {
      // Toggle visibility.
      showOptionsPanel(!optionsPanelVisible);
    }
    return false;
  } else if (getKeyColor(evt) === 'blue') {
    evt.preventDefault();
    evt.stopImmediatePropagation();

    if (evt.type === 'keydown') {
      // Toggle Audio-Only mode.
      initAudioOnlyToggle();
    }
    return false;
  }
  return true;
};

// Intercept remote keys before YouTube translates them into a second event.
// Otherwise a single green press can toggle the panel open and closed.
window.addEventListener('keydown', eventHandler, true);
window.addEventListener('keypress', eventHandler, true);
window.addEventListener('keyup', eventHandler, true);

const COLOR_MAP = {
  red: 'rgba(255, 0, 0, 0.9)',
  green: 'rgba(0, 162, 0, 0.9)',
  yellow: 'rgba(255, 255, 0, 0.9)',
  blue: 'rgba(0, 128, 255, 0.9)',
  grey: 'rgba(255, 255, 255, 0.5)',
  none: 'rgba(0, 0, 0, 0)'
};

export function showNotification(text, time = 3000, color = 'grey') {
  if (!document.querySelector('.ytaf-notification-container')) {
    console.debug('Adding notification container');
    const c = document.createElement('div');
    c.classList.add('ytaf-notification-container');
    document.body.appendChild(c);
  }

  const elm = document.createElement('div');
  const elmInner = document.createElement('div');
  elmInner.innerText = text;
  elmInner.classList.add('message');
  elmInner.classList.add('message-hidden');
  elm.appendChild(elmInner);
  document.querySelector('.ytaf-notification-container').appendChild(elm);
  elmInner.style.borderColor = COLOR_MAP[color] || color;

  setTimeout(() => {
    elmInner.classList.remove('message-hidden');
  }, 100);
  setTimeout(() => {
    elmInner.classList.add('message-hidden');
    setTimeout(() => {
      elm.remove();
    }, 1000);
  }, time);
}

/**
 * Initialize ability to hide YouTube logo in top right corner.
 */
function initHideLogo() {
  const style = document.createElement('style');
  document.head.appendChild(style);

  /** @type {(hide: boolean) => void} */
  const setHidden = (hide) => {
    const visibility = hide ? 'hidden' : 'visible';
    style.textContent = `ytlr-redux-connect-ytlr-logo-entity { visibility: ${visibility}; }`;
  };

  setHidden(configRead('hideLogo'));

  configAddChangeListener('hideLogo', (evt) => {
    setHidden(evt.detail.newValue);
  });
}

function applyUIFixes() {
  try {
    const bodyClasses = document.body.classList;

    const observer = new MutationObserver(function bodyClassCallback(
      _records,
      _observer
    ) {
      try {
        if (bodyClasses.contains('app-quality-root')) {
          bodyClasses.remove('app-quality-root');
        }
      } catch (e) {
        console.error('error in <body> class observer callback:', e);
      }
    });

    observer.observe(document.body, {
      subtree: false,
      childList: false,
      attributes: true,
      attributeFilter: ['class'],
      characterData: false
    });
  } catch (e) {
    console.error('error setting up <body> class observer:', e);
  }
}

let audioOnlyEnabled = false;
let overlayObserver = null;

async function initAudioOnlyToggle() {
  const elVideo = await requireElement('video', HTMLVideoElement);

  audioOnlyEnabled = !audioOnlyEnabled;
  elVideo.style.visibility = audioOnlyEnabled ? 'hidden' : '';

  const AUDIO_OVERLAY_SELECTOR = '.ytLrAudioPlayerOverlayAudioMode';
  const YTAF_OVERLAY_CLASS = 'ytaf-ui-watchControl-overlayMessage';

  const applyAudioOverlayFilter = () => {
    const node = document.querySelector(AUDIO_OVERLAY_SELECTOR);
    if (!node) return;
    if (audioOnlyEnabled) {
      node.style.setProperty('filter', 'brightness(0)', 'important');
    } else {
      node.style.removeProperty('filter');
    }
  };
  applyAudioOverlayFilter();

  showNotification(
    `Audio-Only mode: ${audioOnlyEnabled ? 'Enabled' : 'Disabled'}`,
    2000,
    'blue'
  );

  const controlsContainer = await requireElement(
    '[idomkey="controls"]',
    HTMLElement
  );

  const updateOverlay = (root = controlsContainer) => {
    let overlay = root.querySelector(`.${YTAF_OVERLAY_CLASS}`);

    if (!audioOnlyEnabled) {
      overlay?.remove();
      return;
    }

    if (overlay) return;

    overlay = Object.assign(document.createElement('div'), {
      textContent: 'Audio-Only Mode Enabled - Press [BLUE] to toggle',
      className: YTAF_OVERLAY_CLASS
    });
    root.prepend(overlay);
  };
  updateOverlay();

  if (overlayObserver) overlayObserver.disconnect();
  overlayObserver = new MutationObserver(() => {
    updateOverlay();
    applyAudioOverlayFilter();
  });

  overlayObserver.observe(controlsContainer, {
    childList: true,
    subtree: true
  });
}

applyUIFixes();
initHideLogo();

setTimeout(() => {
  showNotification(
    'Press [GREEN] to open YTAF configuration screen',
    2000,
    'green'
  );
});
