export type webOSLaunchParams = Record<string, unknown>;

declare global {
  /** Version from package.json, set at build time */
  const __YTAF_VERSION__: string;
  /** The fork's Homebrew Channel repository (`apps.json`), set at build time */
  const __YTAF_UPDATE_URL__: string;

  interface Window {
    /** JSON-encoded `webOSLaunchParams` */
    launchParams?: string;
    __ytaf_debug__?: boolean;
    /** Set by YouTube's page: the home screen it fetches before the user script runs */
    pendingEarlyBrowse?: Promise<{ response?: unknown } | undefined>;
  }

  interface Document {
    addEventListener(
      eventName: 'webOSRelaunch',
      listener: (evt: CustomEvent<webOSLaunchParams>) => void,
      useCapture?: boolean
    ): void;
  }
}
