import { configRead, configAddChangeListener } from './config';
import './watch.css';
import { requireElement } from './dom';

/**
 * The clock in the top-right corner. Hidden while the player has focus (a
 * video playing full screen), unless pinned.
 */
class Watch {
  #watch = document.createElement('div');
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer;
  /** @type {HTMLElement | null} */
  #player = null;
  /** @type {MutationObserver | null} */
  #playerObserver = null;
  #pinned = false;
  #destroyed = false;

  constructor() {
    this.#watch.className = 'webOs-watch';
    document.body.appendChild(this.#watch);
    this.#startClock();
    void this.#followPlayerFocus();
  }

  #startClock() {
    const formatter = new Intl.DateTimeFormat(navigator.language, {
      hour: 'numeric',
      minute: 'numeric'
    });

    const setTime = () => {
      this.#watch.innerText = formatter.format(new Date());
    };

    setTime();
    this.#timer = setTimeout(
      () => {
        setTime();
        this.#timer = setInterval(setTime, 60000);
      },
      (60 - new Date().getSeconds()) * 1000
    );
  }

  async #followPlayerFocus() {
    const player = await requireElement('ytlr-watch-default', HTMLElement);
    if (this.#destroyed) return;

    this.#player = player;
    this.#updateVisibility();
    this.#playerObserver = new MutationObserver(() => this.#updateVisibility());
    this.#playerObserver.observe(player, {
      attributes: true,
      attributeFilter: ['hybridnavfocusable']
    });
  }

  #updateVisibility() {
    const focused = this.#player?.getAttribute('hybridnavfocusable') === 'true';
    this.#watch.style.display = focused && !this.#pinned ? 'none' : 'block';
  }

  /** @param {boolean} pinned */
  setPinned(pinned) {
    this.#pinned = pinned;
    this.#updateVisibility();
  }

  destroy() {
    this.#destroyed = true;
    clearTimeout(this.#timer);
    clearInterval(this.#timer);
    this.#watch.remove();
    this.#playerObserver?.disconnect();
  }
}

/** @type {Watch | null} */
let watchInstance = null;

function refreshWatch() {
  const pinned = configRead('keepWatchPinned');

  // "Always show clock" shows it even with "Show clock" off.
  if (configRead('showWatch') || pinned) {
    watchInstance ??= new Watch();
    watchInstance.setPinned(pinned);
  } else {
    watchInstance?.destroy();
    watchInstance = null;
  }
}

refreshWatch();

configAddChangeListener('showWatch', refreshWatch);
configAddChangeListener('keepWatchPinned', refreshWatch);
