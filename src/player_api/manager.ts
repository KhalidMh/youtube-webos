import { CustomEventTarget, TypedCustomEvent } from '../custom-event-target';
import { requireElement } from '../dom';
import type { PlayerStateObject, VideoID, YTPlayer } from './yt-api';

function diffPlayerState(
  prev: PlayerStateObject | null,
  next: PlayerStateObject
) {
  if (!prev) return next;

  const changes: Partial<PlayerStateObject> = {};

  for (const k in next) {
    const key = k as keyof PlayerStateObject;
    if (next[key] !== prev[key]) {
      changes[key] = next[key];
    }
  }

  return changes;
}

interface EventMap {
  newVideo: CustomEvent<VideoID>;
  /** The first playback of each video, outside a home screen preview. */
  videoStart: CustomEvent<undefined>;
}

class PlayerManager extends CustomEventTarget<EventMap> {
  #player;
  #lastVideoID: VideoID | null = null;
  #lastPlayerState: PlayerStateObject | null = null;
  #videoStarted = false;

  #handlePlayerStateChange = () => {
    const current = this.#player.getPlayerStateObject();
    const diff = diffPlayerState(this.#lastPlayerState, current);
    this.#lastPlayerState = current;

    // Assume video ID hasn't changed if diff is empty.
    if (Object.keys(diff).length === 0) return;

    console.debug('[PlayerManager] player state changed', { diff });

    // No video loaded (e.g. after leaving one).
    const currentVideoID = this.#player.getVideoData().video_id;
    if (!currentVideoID) return;

    if (this.#lastVideoID !== currentVideoID) {
      console.debug('[PlayerManager] new video', currentVideoID);
      this.#lastVideoID = currentVideoID;
      this.#videoStarted = false;
      this.dispatchEvent(
        new TypedCustomEvent('newVideo', { detail: currentVideoID })
      );
    }

    if (diff.isPlaying && !this.#videoStarted && !this.#player.isInline()) {
      this.#videoStarted = true;
      this.dispatchEvent(new TypedCustomEvent('videoStart'));
    }
  };

  constructor(player: YTPlayer) {
    super();
    this.#player = player;

    player.addEventListener('onStateChange', this.#handlePlayerStateChange);
  }

  get player(): YTPlayer {
    return this.#player;
  }
}

let instance: Promise<PlayerManager> | null = null;

/** Resolves once YouTube has created its player element. */
export function getPlayerManager(): Promise<PlayerManager> {
  instance ??= requireElement('.html5-video-player', HTMLElement).then(
    (player) => new PlayerManager(player as YTPlayer)
  );
  return instance;
}

export type { PlayerManager };
