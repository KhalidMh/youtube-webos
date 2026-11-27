import { handleLaunch } from './launch';

// The app is already open: a deep link, cast or voice request reaches it here.
document.addEventListener(
  'webOSRelaunch',
  (evt) => {
    console.info('RELAUNCH:', evt, window.launchParams);
    handleLaunch(evt.detail);
  },
  true
);
