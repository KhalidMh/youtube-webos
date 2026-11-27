/**
 * Tells the user when a newer version of this fork is available.
 *
 * Homebrew Channel does not update apps in the background, so without this
 * people stay on old versions, which break as YouTube changes. At most once a
 * day, this reads the fork's Homebrew Channel repository (`apps.json`, deployed
 * by the release workflow) and compares its version with this build's.
 */

import { configAddChangeListener, configRead } from './config';
import { showNotification } from './notifications';
import { isNewerVersion } from './version-compare.js';

const APP_ID = 'youtube.leanback.v4';
const STORAGE_KEY = 'ytaf-update-check';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Stay out of the way of the app's own startup requests.
const STARTUP_DELAY_MS = 20 * 1000;

interface UpdateState {
  lastCheck: number;
  latestVersion?: string;
}

interface HomebrewRepo {
  packages?: { id?: string; manifest?: { version?: string } }[];
}

function loadState(): UpdateState {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? 'null'
    ) as Partial<UpdateState> | null;
    if (typeof stored?.lastCheck === 'number') {
      return typeof stored.latestVersion === 'string'
        ? { lastCheck: stored.lastCheck, latestVersion: stored.latestVersion }
        : { lastCheck: stored.lastCheck };
    }
  } catch (err) {
    console.warn('[update-check] Ignoring unreadable state', err);
  }
  return { lastCheck: 0 };
}

function saveState(state: UpdateState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[update-check] Could not save state', err);
  }
}

async function fetchLatestVersion(): Promise<string | undefined> {
  const response = await fetch(`${__YTAF_UPDATE_URL__}?t=${Date.now()}`, {
    credentials: 'omit'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const repo = (await response.json()) as HomebrewRepo;
  return repo.packages?.find((pkg) => pkg.id === APP_ID)?.manifest?.version;
}

export interface UpdateStatus {
  /** Empty while unknown. */
  text: string;
  updateAvailable: boolean;
}

let status: UpdateStatus = { text: '', updateAvailable: false };
const statusListeners: ((status: UpdateStatus) => void)[] = [];

/** Calls `listener` with the current status, then on every change. */
export function onUpdateStatus(listener: (status: UpdateStatus) => void) {
  statusListeners.push(listener);
  listener(status);
}

function setStatus(next: UpdateStatus) {
  status = next;
  for (const listener of statusListeners) listener(status);
}

/** Records the status for `latest`; returns whether it is newer. */
function showStatus(latest: string | undefined): boolean {
  if (latest === undefined) return false;

  const updateAvailable = isNewerVersion(latest, __YTAF_VERSION__);
  setStatus({
    text: updateAvailable ? `update available: v${latest}` : 'up to date',
    updateAvailable
  });
  return updateAvailable;
}

let checking = false;

async function checkForUpdates() {
  if (!configRead('checkForUpdates') || checking) return;

  const state = loadState();
  showStatus(state.latestVersion);

  const now = Date.now();
  // A clock that went backwards (unset at boot) counts as due.
  if (state.lastCheck <= now && now - state.lastCheck < CHECK_INTERVAL_MS)
    return;

  checking = true;
  try {
    const latest = await fetchLatestVersion();
    saveState(
      latest === undefined
        ? { lastCheck: now }
        : { lastCheck: now, latestVersion: latest }
    );

    if (showStatus(latest)) {
      console.info(`[update-check] v${latest} is available`);
      showNotification(
        `YouTube AdFree v${latest} is available. Update it in Homebrew Channel.`,
        10000
      );
    }
  } catch (err) {
    // Offline, or no release published yet: try again on a later launch.
    console.warn('[update-check] Check failed', err);
  } finally {
    checking = false;
  }
}

window.setTimeout(() => void checkForUpdates(), STARTUP_DELAY_MS);

configAddChangeListener('checkForUpdates', (enabled) => {
  if (enabled) {
    void checkForUpdates();
  } else {
    setStatus({ text: '', updateAvailable: false });
  }
});
