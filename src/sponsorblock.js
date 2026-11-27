import sha256 from 'tiny-sha256';
import { configRead } from './config';
import { SPONSORBLOCK_CATEGORIES as CATEGORIES } from './sponsorblock-categories.js';
import { showNotification } from './notifications';
import './sponsorblock.css';

/** @param {string} id */
function getCategory(id) {
  return CATEGORIES.find((category) => category.id === id);
}

const sponsorblockAPI = 'https://sponsorblock.inf.re/api';

class SponsorBlockHandler {
  video = null;
  active = true;

  attachVideoTimeout = null;
  nextSkipTimeout = null;

  slider = null;
  sliderInterval = null;
  sliderObserver = null;
  sliderSegmentsOverlay = null;

  scheduleSkipHandler = null;
  durationChangeHandler = null;
  segments = null;
  skippableCategories = [];

  constructor(videoID) {
    this.videoID = videoID;
  }

  async init() {
    const videoHash = sha256(this.videoID).substring(0, 4);
    const categories = CATEGORIES.map((category) => category.id);
    const resp = await fetch(
      `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(
        JSON.stringify(categories)
      )}`
    );
    const results = await resp.json();
    // Destroyed while the request was in flight: the video has changed.
    if (!this.active) return;

    const result = results.find((v) => v.videoID === this.videoID);
    console.debug(this.videoID, 'Got it:', result);

    if (!result || !result.segments || !result.segments.length) {
      console.debug(this.videoID, 'No segments found.');
      return;
    }

    this.segments = result.segments;
    this.skippableCategories = this.getSkippableCategories();

    this.scheduleSkipHandler = () => this.scheduleSkip();
    this.durationChangeHandler = () => this.buildOverlay();

    this.attachVideo();
    this.buildOverlay();
  }

  getSkippableCategories() {
    return CATEGORIES.filter((category) => configRead(category.option.key)).map(
      (category) => category.id
    );
  }

  attachVideo() {
    clearTimeout(this.attachVideoTimeout);
    this.attachVideoTimeout = null;

    this.video = document.querySelector('video');
    if (!this.video) {
      console.debug(this.videoID, 'No video yet...');
      this.attachVideoTimeout = setTimeout(() => this.attachVideo(), 100);
      return;
    }

    console.debug(this.videoID, 'Video found, binding...');

    this.video.addEventListener('play', this.scheduleSkipHandler);
    this.video.addEventListener('pause', this.scheduleSkipHandler);
    this.video.addEventListener('timeupdate', this.scheduleSkipHandler);
    this.video.addEventListener('durationchange', this.durationChangeHandler);
  }

  buildOverlay() {
    if (this.sliderSegmentsOverlay) {
      console.debug('Overlay already built');
      return;
    }

    if (!this.video || !this.video.duration) {
      console.debug('No video duration yet');
      return;
    }

    const videoDuration = this.video.duration;

    this.sliderSegmentsOverlay = document.createElement('div');
    this.sliderSegmentsOverlay.className =
      'ytaf-sponsorblock-segment-container';

    this.segments.forEach((segment) => {
      const [start, end] = segment.segment;
      const elm = document.createElement('div');
      elm.className = 'ytaf-sponsorblock-segment';
      elm.style['background-color'] =
        getCategory(segment.category)?.color ?? 'blue';
      elm.style['left'] = `${(start / videoDuration) * 100.0}%`;
      elm.style['width'] = `${((end - start) / videoDuration) * 100.0}%`;
      this.sliderSegmentsOverlay.appendChild(elm);
    });

    const addSliderObserver = (ele) => {
      this.sliderObserver.observe(ele, {
        childList: true,
        subtree: true
      });
    };

    const addSliderOverlay = () => {
      this.slider.appendChild(this.sliderSegmentsOverlay);
    };

    const watchForSlider = () => {
      if (this.sliderInterval) clearInterval(this.sliderInterval);

      this.sliderInterval = setInterval(() => {
        const nodes = document.querySelectorAll('[idomkey=progress-bar]');
        const last = nodes[nodes.length - 1];
        switch (nodes.length) {
          case 3: {
            // Slider has chapter markers.
            this.slider = last;
            break;
          }
          case 2: {
            // Slider has no markers or auto-markers
            this.slider = last.querySelector('[idomkey=slider]');
            break;
          }
          default: {
            return; // no slider found yet
          }
        }

        console.debug('slider found...', this.slider);
        clearInterval(this.sliderInterval);
        this.sliderInterval = null;
        addSliderObserver(last);
        addSliderOverlay();
      }, 100);
    };

    this.sliderObserver = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        for (const node of m.removedNodes) {
          if (node === this.sliderSegmentsOverlay) {
            console.debug('bringing back segments overlay');
            addSliderOverlay();
          }
          if (node === this.slider) {
            console.debug('slider removed, watching again');
            this.sliderObserver.disconnect();
            watchForSlider();
          }
        }
      });
    });

    watchForSlider();
  }

  scheduleSkip() {
    clearTimeout(this.nextSkipTimeout);
    this.nextSkipTimeout = null;

    if (!this.active) {
      console.debug(this.videoID, 'No longer active, ignoring...');
      return;
    }

    if (this.video.paused) {
      console.debug(this.videoID, 'Currently paused, ignoring...');
      return;
    }

    // Sometimes timeupdate event (that calls scheduleSkip) gets fired right before
    // already scheduled skip routine below. Let's just look back a little bit
    // and, in worst case, perform a skip at negative interval (immediately)...
    const nextSegments = this.segments.filter(
      (seg) =>
        seg.segment[0] > this.video.currentTime - 0.3 &&
        seg.segment[1] > this.video.currentTime - 0.3
    );
    nextSegments.sort((s1, s2) => s1.segment[0] - s2.segment[0]);

    if (!nextSegments.length) {
      console.debug(this.videoID, 'No more segments');
      return;
    }

    const [segment] = nextSegments;
    const [start, end] = segment.segment;
    console.debug(
      this.videoID,
      'Scheduling skip of',
      segment,
      'in',
      start - this.video.currentTime
    );

    this.nextSkipTimeout = setTimeout(
      () => {
        if (this.video.paused) {
          console.debug(this.videoID, 'Currently paused, ignoring...');
          return;
        }
        if (!this.skippableCategories.includes(segment.category)) {
          console.debug(
            this.videoID,
            'Segment',
            segment.category,
            'is not skippable, ignoring...'
          );
          return;
        }

        const skipName =
          getCategory(segment.category)?.name ?? segment.category;
        console.debug(this.videoID, 'Skipping', segment);
        showNotification(`Skipping ${skipName}`, 2000, 'indigo');
        this.video.currentTime = end;
        this.scheduleSkip();
      },
      (start - this.video.currentTime) * 1000
    );
  }

  destroy() {
    console.debug(this.videoID, 'Destroying');

    this.active = false;

    if (this.nextSkipTimeout) {
      clearTimeout(this.nextSkipTimeout);
      this.nextSkipTimeout = null;
    }

    if (this.attachVideoTimeout) {
      clearTimeout(this.attachVideoTimeout);
      this.attachVideoTimeout = null;
    }

    if (this.sliderInterval) {
      clearInterval(this.sliderInterval);
      this.sliderInterval = null;
    }

    if (this.sliderObserver) {
      this.sliderObserver.disconnect();
      this.sliderObserver = null;
    }

    if (this.sliderSegmentsOverlay) {
      this.sliderSegmentsOverlay.remove();
      this.sliderSegmentsOverlay = null;
    }

    if (this.video) {
      this.video.removeEventListener('play', this.scheduleSkipHandler);
      this.video.removeEventListener('pause', this.scheduleSkipHandler);
      this.video.removeEventListener('timeupdate', this.scheduleSkipHandler);
      this.video.removeEventListener(
        'durationchange',
        this.durationChangeHandler
      );
    }
  }
}

// When this global variable was declared using let and two consecutive hashchange
// events were fired (due to bubbling? not sure...) the second call handled below
// would not see the value change from first call, and that would cause multiple
// SponsorBlockHandler initializations... This has been noticed on Chromium 38.
// This either reveals some bug in chromium/webpack/babel scope handling, or
// shows my lack of understanding of javascript. (or both)
window.sponsorblock = null;

function uninitializeSponsorblock() {
  if (!window.sponsorblock) {
    return;
  }
  try {
    window.sponsorblock.destroy();
  } catch (err) {
    console.warn('window.sponsorblock.destroy() failed!', err);
  }
  window.sponsorblock = null;
}

window.addEventListener(
  'hashchange',
  () => {
    const newURL = new URL(location.hash.substring(1), location.href);
    // uninitialize sponsorblock when not on `/watch` path, to prevent
    // it from attaching to playback preview video element loaded on
    // home page
    if (newURL.pathname !== '/watch' && window.sponsorblock) {
      console.debug('uninitializing sponsorblock on a non-video page');
      uninitializeSponsorblock();
      return;
    }

    const videoID = newURL.searchParams.get('v');
    const needsReload =
      videoID &&
      (!window.sponsorblock || window.sponsorblock.videoID != videoID);

    console.debug(
      'hashchange',
      videoID,
      window.sponsorblock,
      window.sponsorblock ? window.sponsorblock.videoID : null,
      needsReload
    );

    if (needsReload) {
      uninitializeSponsorblock();

      if (configRead('enableSponsorBlock')) {
        window.sponsorblock = new SponsorBlockHandler(videoID);
        window.sponsorblock.init();
      } else {
        console.info('SponsorBlock disabled, not loading');
      }
    }
  },
  false
);
