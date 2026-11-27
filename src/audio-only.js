/** BLUE toggles audio-only mode: the video is hidden, the sound plays on. */

import './audio-only.css';
import { requireElement } from './dom';
import { showNotification } from './notifications';
import { onColorKey } from './remote-keys';

const AUDIO_OVERLAY_SELECTOR = '.ytLrAudioPlayerOverlayAudioMode';
const MESSAGE_CLASS = 'ytaf-audio-only-message';

let audioOnlyEnabled = false;
/** @type {MutationObserver | null} */
let overlayObserver = null;

function applyAudioOverlayFilter() {
  /** @type {HTMLElement | null} */
  const node = document.querySelector(AUDIO_OVERLAY_SELECTOR);
  if (!node) return;
  if (audioOnlyEnabled) {
    node.style.setProperty('filter', 'brightness(0)', 'important');
  } else {
    node.style.removeProperty('filter');
  }
}

/** @param {HTMLElement} controls */
function updateMessage(controls) {
  const message = controls.querySelector(`.${MESSAGE_CLASS}`);

  if (!audioOnlyEnabled) {
    message?.remove();
    return;
  }

  if (message) return;

  controls.prepend(
    Object.assign(document.createElement('div'), {
      textContent: 'Audio-Only Mode Enabled - Press [BLUE] to toggle',
      className: MESSAGE_CLASS
    })
  );
}

async function toggleAudioOnly() {
  const video = await requireElement('video', HTMLVideoElement);

  audioOnlyEnabled = !audioOnlyEnabled;
  video.style.visibility = audioOnlyEnabled ? 'hidden' : '';
  applyAudioOverlayFilter();

  showNotification(
    `Audio-Only mode: ${audioOnlyEnabled ? 'Enabled' : 'Disabled'}`,
    2000,
    'blue'
  );

  const controls = await requireElement('[idomkey="controls"]', HTMLElement);
  updateMessage(controls);

  overlayObserver?.disconnect();
  overlayObserver = new MutationObserver(() => {
    updateMessage(controls);
    applyAudioOverlayFilter();
  });
  overlayObserver.observe(controls, { childList: true, subtree: true });
}

onColorKey('blue', () => void toggleAudioOnly());
