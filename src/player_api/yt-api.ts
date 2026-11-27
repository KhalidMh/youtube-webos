interface YTPlayerEventMap extends HTMLElementEventMap {
  /** -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued */
  onStateChange: number;
}

export interface VideoQualityData {
  formatId: string | undefined;
  qualityLabel: string;
  isPlayable: boolean;
}

export type VideoID = string;

export interface VideoData {
  video_id: VideoID | undefined;
  isLive?: boolean;
}

export type PlayerStateKeys =
  | 'isBuffering'
  | 'isCued'
  | 'isDomPaused'
  | 'isEnded'
  | 'isError'
  | 'isOrWillBePlaying'
  | 'isPaused'
  | 'isPlaying'
  | 'isSeeking'
  | 'isUiSeeking'
  | 'isUnstarted';

export type PlayerStateObject = Record<PlayerStateKeys, boolean>;

export interface YTPlayer extends HTMLElement {
  addEventListener<K extends keyof YTPlayerEventMap>(
    type: K,
    listener: (this: YTPlayer, ev: YTPlayerEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;

  getPlaybackQualityLabel(): string; // empty if not available

  getCurrentTime(): number;

  /**
   * Not available until first `isPlaying` state of playback.
   *
   * Empty if not available.
   */
  getAvailableQualityData(): VideoQualityData[];

  setPlaybackQualityRange(min: string, max: string, formatId?: string): void;

  getVideoData(): VideoData;

  getPlayerStateObject(): PlayerStateObject;

  /** `true` while playing a home screen preview. */
  isInline(): boolean;
}
