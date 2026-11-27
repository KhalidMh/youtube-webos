/**
 * Fixes webosbrew/youtube-webos/issues/343 without breaking casting
 * (webosbrew/youtube-webos/issues/401): the webOS Chromecast service is only
 * kept asleep when the app was not started by a cast launch.
 */

import { configRead } from './config';
import { FetchRegistry } from './hooks/fetch';
import { hasCastParams, isCastLaunch } from './launch';

// The launch params end up in the URL's query (see `handleLaunch`).
let castLaunch = hasCastParams(window.location.search);

document.addEventListener(
  'webOSRelaunch',
  (evt) => {
    if (isCastLaunch(evt.detail)) castLaunch = true;
  },
  true
);

FetchRegistry.getInstance().addEventListener('request', (evt) => {
  const { url } = evt.detail;

  if (url.pathname !== '/wake_cast_core') return;
  if (!configRead('blockWebosCast')) return;
  if (castLaunch) return;

  evt.preventDefault();
});
