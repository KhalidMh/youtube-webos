# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ad-free YouTube TV app for LG webOS ("YTAF"). This repo is a community-maintained fork of `webosbrew/youtube-webos` (remote `upstream`); it is maintained independently and is not contributed back. See "Fork workflow" below.

## Commands

pnpm is required (`devEngines` rejects npm; run `corepack enable` if pnpm is missing). Node >= 22.

```sh
pnpm install
pnpm build            # production webpack build -> dist/
pnpm build:dev        # development build (inline source maps)
pnpm lint:all         # eslint + tsc -b + prettier --check (all must pass)
pnpm test:compat      # es-check: dist/**/*.js must be ES5 — run after build
pnpm test            # every tests/**/*.test.js (node:test)
node --test --test-name-pattern "voice intent" tests/launch.test.js   # single test

pnpm package          # dist/ -> youtube.leanback.v4_<version>_all.ipk
pnpm deploy           # ares-install the ipk to the default TV
pnpm launch           # ares-launch youtube.leanback.v4
pnpm inspect          # ares-inspect: prints a DevTools URL for the app's console
pnpm exec ares-setup-device   # add/select a TV (interactive)
```

A husky pre-commit hook runs lint-staged (prettier, eslint, `tsc -b`). Tests import plain-JS modules from `src/` directly with Node, so logic worth testing is kept in browser-free `.js` modules (e.g. `clutter-filters.js`, `version-compare.js`) with a thin hooking module around them. Beyond that, verification is lint + build + `test:compat`, then testing on a real TV.

## Architecture

**Two bundles** (`webpack.config.js`):

- `src/index.js` → `dist/index.js`: the app's launcher page (`src/index.html`). It waits for network (`wait-for-network.ts`), then `handleLaunch()` (`src/utils.js`) turns webOS launch params (deep links, DIAL/cast `contentTarget`, voice intents) into a `https://www.youtube.com/tv...` URL and navigates there.
- `src/userScript.ts` → `dist/webOSUserScripts/userScript.js`: webOS injects this into the YouTube TV web page (~3 s after page start, so anything YouTube does earlier is missed — see `early-browse.ts`). Everything the app adds lives here.

`assets/` is copied into `dist/`; `appinfo.json`'s `version` is overwritten from `package.json` at build time (`package.json` is the single source of the version; `__YTAF_VERSION__` is also injected).

**Feature modules are side-effect imports** listed in `src/userScript.ts`. Order matters: polyfills first, and modules that patch globals before code that depends on them. A new feature = a new module + an import line.

**Interception techniques** used across modules (understand these before changing behavior):

- `JSON.parse` monkey-patching: several modules (`adblock.js`, `shorts.js`, `thumbnail-quality.ts`, `subtitles.ts`, `disable-you-there.ts`, `video-codec.ts`) each wrap `JSON.parse` in turn and mutate InnerTube responses in place. They chain, so each must call the previous `JSON.parse` and return its result.
- `JSON.stringify` hook (`hooks/json-stringify.ts`) edits outgoing player requests. Objects may be frozen — copy, don't mutate, and never use `structuredClone` (it throws on values JSON accepts).
- `FetchRegistry` (`hooks/fetch.ts`): singleton wrapping `window.fetch`; modules listen for `request`/`response` events and can `preventDefault()` a request (e.g. `block-webos-cast.ts`).
- Player API (`player_api/`): `await getPlayerManager()` gives a `PlayerManager` that emits `newVideo` and `playbackStart`; `player` is YouTube's internal player element (typed in `yt-api.ts`, undocumented). Check `playerMode === PlayerMode.PREVIEW` to skip home-screen previews.
- `remove-clutter.ts` + `clutter-filters.js`: generic walk of InnerTube responses dropping guest sign-in prompts and the "Most relevant" shelf, and the player's QR-code overlay (`timelyActionRenderers`). `early-browse.ts` applies the same filters (ads, Shorts, clutter) to the home screen YouTube fetches before the userScript is injected — new response filters should be added there too.
- `update-check.ts`: once a day fetches the fork's Homebrew repository (`__YTAF_UPDATE_URL__`, set at build time from `package.json` `repository` via `tools/repo-info.cjs`) and notifies when a newer version exists.
- `CustomEventTarget` (`custom-event-target.ts`) is the typed event base class; it is backed by a `DocumentFragment` because `new EventTarget()` throws on old webOS.

**Config / settings UI**: options are declared in the `configOptions` Map in `src/config.js` (`default`, `desc`) and persisted in `localStorage`. Read with `configRead(key)`, react with `configAddChangeListener(key, cb)`. The settings panel (GREEN remote button) is tabbed: place a new option in a section of `PANEL_SECTIONS` in `src/ui.js` (options left out land in an "Other" tab). The panel handles arrow keys itself (tab bar, then up/down through the open section's options) instead of relying on the spatial-navigation polyfill, which skips options scrolled out of view. Unknown keys throw. `showNotification()` from `ui.js` shows toasts. BLUE toggles audio-only mode.

## Compatibility constraints

Targets range from webOS 1 (Safari 7 WebKit) to webOS 24 (Chrome 108) — see `.browserslistrc`. Babel + core-js polyfill syntax and builtins, and output must pass `test:compat` (ES5). Watch for DOM APIs that polyfills don't cover (e.g. `EventTarget` constructor, native `fetch` absent on webOS 3.x). Top-level `await` is allowed in modules (handled by `TransformAsyncModulesPlugin`). Don't use `devtool: 'eval'` (crashes old webOS).

## Fork workflow

- Upstream PRs are fetched as `refs/remotes/upstream/pr/<N>` (`git fetch upstream '+refs/pull/*/head:refs/remotes/upstream/pr/*'`). Merge them with `--no-ff` to keep contributor authorship, and credit each in `CHANGELOG.md` under the fork section.
- The app ID stays `youtube.leanback.v4` (required for the remote's YouTube button, casting and voice). The fork's version must stay higher than upstream's so Homebrew Channel doesn't treat upstream as an update.
- Release: push a `v*` tag. `.github/workflows/release.yml` builds, publishes the ipk + `youtube.leanback.v4.manifest.json` as a GitHub release, then runs `pnpm repo` (`tools/gen-repo.cjs`) and deploys `apps.json` (Homebrew Channel repository format) to GitHub Pages at `https://khalidmh.github.io/youtube-webos/apps.json`. Repo URLs in the manifest come from `repository` in `package.json` (`tools/repo-info.cjs`).
