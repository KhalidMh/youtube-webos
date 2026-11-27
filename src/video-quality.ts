/**
 * Sets the quality range at the start of each video, for the two options
 * that need it: "Force max resolution" and "Prefer VP9 codec" (which also
 * pins the VP9 format, see `video-codec.ts`).
 */

import { configRead } from './config';
import { showNotification } from './notifications';
import { getPlayerManager } from './player_api/manager';
import { getPreferredVp9FormatId } from './video-codec';

const playerManager = await getPlayerManager();
const player = playerManager.player;

function getMaxQualityLabel() {
  return player.getAvailableQualityData()[0]?.qualityLabel;
}

function notifyPlaybackQuality() {
  showNotification(
    `${player.getPlaybackQualityLabel()} selected (Max ${getMaxQualityLabel()})`,
    3000
  );
}

/**
 * Changing the quality range makes YouTube reload the `<video>` element. On
 * webOS 25, the reloaded element sometimes does not seek back to the playback
 * position: the player keeps buffering around the position while the element
 * waits at 0, so the video never starts. This happens when playback resumes
 * from a non-zero position, e.g. when a video is opened from its home screen
 * preview or resumed from the watch history.
 *
 * If the element is still out of sync after it has loaded, seek it back to the
 * position reported by the player.
 */
function restorePositionAfterReload() {
  const video = player.querySelector('video');
  if (!video) return;

  const videoID = player.getVideoData().video_id;
  const startTime = Date.now();
  let stalledChecks = 0;

  const intervalToken = window.setInterval(() => {
    if (
      Date.now() - startTime > 15000 ||
      player.getVideoData().video_id !== videoID
    ) {
      clearInterval(intervalToken);
      return;
    }

    const position = player.getCurrentTime();
    const isStalled =
      !video.seeking &&
      video.readyState >= HTMLMediaElement.HAVE_METADATA &&
      video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA &&
      position > 1 &&
      Math.abs(video.currentTime - position) > 1;

    if (!isStalled) {
      stalledChecks = 0;
      return;
    }

    // Leave the player a chance to seek on its own first.
    if (++stalledChecks < 2) return;

    clearInterval(intervalToken);
    console.warn(
      `[video-quality] restoring playback position (${video.currentTime} -> ${position})`
    );
    video.currentTime = position;
  }, 500);
}

/** Notifies once the quality has changed from `prevQuality`. */
function notifyWhenQualityChanges(prevQuality: string) {
  if (prevQuality === getMaxQualityLabel()) {
    notifyPlaybackQuality();
    return;
  }

  // No reliable event for quality change, so poll for it
  const intervalToken = window.setInterval(() => {
    if (player.getPlaybackQualityLabel() !== prevQuality) {
      clearInterval(intervalToken);
      clearTimeout(timeoutToken);
      notifyPlaybackQuality();
    }
  }, 100);

  const timeoutToken = window.setTimeout(() => {
    console.warn('[video-quality] timed out waiting for quality change');
    clearInterval(intervalToken);
    notifyPlaybackQuality();
  }, 3000);
}

playerManager.addEventListener('videoStart', () => {
  const forceHighRes = configRead('forceHighResVideo');
  const forceVp9 = configRead('forceVp9Codec');
  if (!forceHighRes && !forceVp9) return;

  const formatId = forceVp9
    ? getPreferredVp9FormatId(player.getAvailableQualityData())
    : undefined;
  if (forceVp9 && !formatId) {
    console.warn('[video-quality] No playable VP09 formatId available');
    if (!forceHighRes) return;
  }

  console.info(
    `[video-quality] setting playback quality${formatId ? ` (VP09 formatId ${formatId})` : ''}`
  );
  const prevQuality = player.getPlaybackQualityLabel();
  player.setPlaybackQualityRange('highres', 'highres', formatId);
  restorePositionAfterReload();

  if (forceHighRes) notifyWhenQualityChanges(prevQuality);
});
