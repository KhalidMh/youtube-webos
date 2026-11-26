/*global __YTAF_VERSION__*/
import './spatial-navigation-polyfill.js';
import {
  configAddChangeListener,
  configRead,
  configWrite,
  configGetDesc,
  configGetHint,
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

/**
 * One option row: label and hint on the left, a switch on the right.
 *
 * The checkbox stays the focusable element (the panel moves focus between
 * inputs), visually hidden behind the drawn switch. Old webOS has no
 * `:focus-within`, so the row gets a class while its checkbox has focus.
 */
function createConfigCheckbox(key) {
  const elmInput = document.createElement('input');
  elmInput.type = 'checkbox';
  elmInput.className = 'ytaf-ui-option-input';
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
  elmLabel.className = 'ytaf-ui-option';
  elmLabel.appendChild(elmInput);

  const elmText = document.createElement('span');
  elmText.className = 'ytaf-ui-option-text';

  const elmTitle = document.createElement('span');
  elmTitle.className = 'ytaf-ui-option-title';
  elmTitle.textContent = configGetDesc(key);
  elmText.appendChild(elmTitle);

  const hint = configGetHint(key);
  if (hint) {
    const elmHint = document.createElement('span');
    elmHint.className = 'ytaf-ui-option-hint';
    elmHint.textContent = hint;
    elmText.appendChild(elmHint);
  }

  elmLabel.appendChild(elmText);

  const elmSwitch = document.createElement('span');
  elmSwitch.className = 'ytaf-ui-switch';
  elmLabel.appendChild(elmSwitch);

  elmInput.addEventListener('focus', () => {
    elmLabel.classList.add('ytaf-ui-option-focused');
  });
  elmInput.addEventListener('blur', () => {
    elmLabel.classList.remove('ytaf-ui-option-focused');
  });

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
    note: 'Segments are submitted by the SponsorBlock community (sponsor.ajay.app).'
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

  const elmHeader = document.createElement('div');
  elmHeader.className = 'ytaf-ui-header';

  const elmHeading = document.createElement('h1');
  elmHeading.textContent = 'webOS YouTube Extended';
  elmHeader.appendChild(elmHeading);

  const elmVersion = document.createElement('div');
  elmVersion.className = 'ytaf-ui-version';
  elmVersion.textContent = `v${__YTAF_VERSION__}`;

  const elmUpdateStatus = document.createElement('span');
  elmUpdateStatus.className = 'ytaf-ui-update-status';
  elmVersion.appendChild(elmUpdateStatus);
  elmHeader.appendChild(elmVersion);

  elmContainer.appendChild(elmHeader);

  const elmTabBar = document.createElement('div');
  elmTabBar.className = 'ytaf-ui-tabs';
  elmContainer.appendChild(elmTabBar);

  /*
   * Only the options scroll: the header, tabs and footer stay in place.
   *
   * Not with native scrolling: YouTube resets `scrollTop` to 0 on any element
   * that scrolls (a capture `scroll` listener on the page). The options move
   * with a `transform` instead, which fires no scroll events, and the panel
   * draws its own scroll indicator.
   */
  const elmBody = document.createElement('div');
  elmBody.className = 'ytaf-ui-body';
  elmContainer.appendChild(elmBody);

  const elmScroller = document.createElement('div');
  elmScroller.className = 'ytaf-ui-scroller';
  elmBody.appendChild(elmScroller);

  const elmScrollbar = document.createElement('div');
  elmScrollbar.className = 'ytaf-ui-scrollbar';
  const elmScrollThumb = document.createElement('div');
  elmScrollThumb.className = 'ytaf-ui-scrollbar-thumb';
  elmScrollbar.appendChild(elmScrollThumb);
  elmBody.appendChild(elmScrollbar);

  let scrollOffset = 0;

  /** @param {number} offset Pixels scrolled from the top. */
  function scrollOptionsTo(offset) {
    const viewHeight = elmBody.clientHeight;
    const contentHeight = elmScroller.offsetHeight;
    const maxOffset = Math.max(0, contentHeight - viewHeight);
    scrollOffset = Math.min(Math.max(0, offset), maxOffset);

    const transform = `translateY(${-scrollOffset}px)`;
    elmScroller.style.transform = transform;
    elmScroller.style.webkitTransform = transform;

    if (maxOffset === 0) {
      elmScrollbar.style.display = 'none';
      return;
    }
    elmScrollbar.style.display = '';
    const thumbHeight = Math.max(24, (viewHeight * viewHeight) / contentHeight);
    const thumbTop = (scrollOffset / maxOffset) * (viewHeight - thumbHeight);
    elmScrollThumb.style.height = `${thumbHeight}px`;
    elmScrollThumb.style.top = `${thumbTop}px`;
  }

  // Keep the focused row inside the visible area, with a little room around
  // it. The row's position is measured against the scroller, not the screen:
  // both move together, so a slide still in progress does not skew it.
  elmBody.addEventListener(
    'focus',
    (evt) => {
      const row = /** @type {HTMLElement} */ (evt.target).parentElement;
      if (!row) return;
      const margin = 16;
      const scrollerTop = elmScroller.getBoundingClientRect().top;
      const rowRect = row.getBoundingClientRect();
      const rowTop = rowRect.top - scrollerTop;
      const rowBottom = rowRect.bottom - scrollerTop;
      const viewHeight = elmBody.clientHeight;

      const controls = sectionControls();
      if (evt.target === controls[controls.length - 1]) {
        // Last option: show the end of the section too (e.g. its note).
        scrollOptionsTo(Infinity);
      } else if (rowBottom + margin > scrollOffset + viewHeight) {
        scrollOptionsTo(rowBottom + margin - viewHeight);
      } else if (rowTop - margin < scrollOffset) {
        scrollOptionsTo(rowTop - margin);
      }
    },
    true
  );

  const elmFooter = document.createElement('div');
  elmFooter.className = 'ytaf-ui-footer';
  elmFooter.textContent = '◀ ▶ Tabs    ▲ ▼ Options    OK Toggle    BACK Close';
  elmContainer.appendChild(elmFooter);

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
    scrollOptionsTo(0);
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
      const elmNested = document.createElement('div');
      elmNested.className = 'ytaf-ui-nested';
      for (const key of section.nested) {
        elmNested.appendChild(createConfigCheckbox(key));
      }
      elmSection.appendChild(elmNested);

      // The nested options only matter while the section's main option is on.
      const parentKey = section.keys[0];
      if (parentKey) {
        const updateNested = () => {
          elmNested.classList.toggle(
            'ytaf-ui-nested-off',
            !configRead(parentKey)
          );
        };
        updateNested();
        configAddChangeListener(parentKey, updateNested);
      }
    }

    if (section.note) {
      const elmNote = document.createElement('div');
      elmNote.className = 'ytaf-ui-note';
      elmNote.textContent = section.note;
      elmSection.appendChild(elmNote);
    }

    elmScroller.appendChild(elmSection);
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
    // Back to the stylesheet's `display: flex` (the panel is a flex column).
    optionsPanel.style.display = '';
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

/**
 * YouTube moves focus on its own while the panel is open: the home screen
 * preview starting, a page finishing loading. Focus then sat on a tile behind
 * the panel and the remote stopped working in it. Send focus back to the
 * control that last had it.
 */
/** @type {HTMLElement | null} */
let lastPanelFocus = null;

document.addEventListener(
  'focusin',
  (evt) => {
    if (!optionsPanelVisible) return;

    const target = /** @type {Node | null} */ (evt.target);
    if (target && optionsPanel.contains(target)) {
      lastPanelFocus = /** @type {HTMLElement} */ (target);
      return;
    }

    console.debug('[ui] focus left the settings panel, taking it back');
    if (lastPanelFocus && optionsPanel.contains(lastPanelFocus)) {
      lastPanelFocus.focus();
    } else {
      focusActiveTab();
    }
  },
  true
);

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
