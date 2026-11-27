import 'whatwg-fetch';
import './domrect-polyfill';
// Before YouTube parses its first response, and before any module registers a
// filter with it.
import './hooks/json-parse';
// Before YouTube probes which codecs the TV supports.
import './video-codec';

import './relaunch';
import './adblock';
import './subtitles';
import './remove-content';
import './sponsorblock.js';
import './ui.js';
import './audio-only.js';
import './hide-logo.js';
import './font-fix.css';
import './thumbnail-quality';
import './screensaver-fix';
import './yt-fixes';
import './watch.js';
import './video-quality';
import './lang-settings-fix';
import './disable-you-there';
import './block-webos-cast';
import './auto-account-select';
import './live-catchup';
import './update-check';
