/*global __YTAF_VERSION__*/
import './spatial-navigation-polyfill.js';
import {
  configAddChangeListener,
  configRead,
  CONFIG_SECTIONS,
  configWrite
} from './config.js';
import { showNotification } from './notifications';
import { onColorKey } from './remote-keys';
import { onUpdateStatus } from './update-check';
import './ui.css';

// We handle key events ourselves.
window.__spatialNavigation__.keyMode = 'NONE';

const ARROW_KEY_CODE = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

/**
 * One option row: label and hint on the left, a switch on the right.
 *
 * The checkbox stays the focusable element (the panel moves focus between
 * inputs), visually hidden behind the drawn switch. Old webOS has no
 * `:focus-within`, so the row gets a class while its checkbox has focus.
 * @param {import('./config.js').ConfigOption} option
 */
function createConfigCheckbox(option) {
  const elmInput = document.createElement('input');
  elmInput.type = 'checkbox';
  elmInput.className = 'ytaf-ui-option-input';
  elmInput.checked = configRead(option.key);

  elmInput.addEventListener('change', () => {
    configWrite(option.key, elmInput.checked);
  });

  configAddChangeListener(option.key, (checked) => {
    elmInput.checked = checked;
  });

  const elmLabel = document.createElement('label');
  elmLabel.className = 'ytaf-ui-option';
  elmLabel.appendChild(elmInput);

  const elmText = document.createElement('span');
  elmText.className = 'ytaf-ui-option-text';

  const elmTitle = document.createElement('span');
  elmTitle.className = 'ytaf-ui-option-title';
  elmTitle.textContent = option.desc;
  elmText.appendChild(elmTitle);

  const elmHint = document.createElement('span');
  elmHint.className = 'ytaf-ui-option-hint';
  elmHint.textContent = option.hint;
  elmText.appendChild(elmHint);

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
 * The rows of `options`. Each option's children follow it, nested and dimmed
 * while it is off.
 * @param {import('./config.js').ConfigOption[]} options
 * @returns {HTMLElement[]}
 */
function createOptionRows(options) {
  return options.flatMap((option) => {
    const row = createConfigCheckbox(option);
    if (!option.children) return [row];

    const elmNested = document.createElement('div');
    elmNested.className = 'ytaf-ui-nested';
    for (const child of createOptionRows(option.children)) {
      elmNested.appendChild(child);
    }
    const updateNested = (/** @type {boolean} */ on) => {
      elmNested.classList.toggle('ytaf-ui-nested-off', !on);
    };
    updateNested(configRead(option.key));
    configAddChangeListener(option.key, updateNested);

    return [row, elmNested];
  });
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

  CONFIG_SECTIONS.forEach((section, index) => {
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
    for (const row of createOptionRows(section.options)) {
      elmSection.appendChild(row);
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
      focusActiveTab();
    } else if (direction === 'up') {
      if (index === 0) focusActiveTab();
      else controls[index - 1].focus();
    } else if (direction === 'down') {
      controls[index + 1]?.focus();
    }
  }

  elmContainer.addEventListener(
    'keydown',
    (evt) => {
      console.debug('Options panel key event:', evt.type, evt.charCode);

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

  onUpdateStatus((status) => {
    elmUpdateStatus.textContent = status.text ? ` · ${status.text}` : '';
    elmUpdateStatus.classList.toggle(
      'ytaf-ui-update-available',
      status.updateAvailable
    );
  });

  return { elmContainer, focusActiveTab };
}

const { elmContainer: optionsPanel, focusActiveTab } = createOptionsPanel();
document.body.appendChild(optionsPanel);

let optionsPanelVisible = false;

/** @param {boolean} visible */
function showOptionsPanel(visible) {
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

onColorKey('green', () => showOptionsPanel(!optionsPanelVisible));

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

showNotification(
  'Press [GREEN] to open YTAF configuration screen',
  2000,
  'green'
);
