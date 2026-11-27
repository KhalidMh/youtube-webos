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
pnpm run deploy       # ares-install the ipk to the default TV
pnpm launch           # ares-launch youtube.leanback.v4
pnpm inspect          # ares-inspect: prints a DevTools URL for the app's console
pnpm exec ares-setup-device   # add/select a TV (interactive)
```

A husky pre-commit hook runs lint-staged (prettier, eslint, `tsc -b`). Tests import plain-JS modules from `src/` directly with Node, so logic worth testing is kept in browser-free `.js` modules (e.g. `response-filters.js`, `version-compare.js`, `launch.js`) with a thin hooking module around them. Beyond that, verification is lint + build + `test:compat`, then testing on a real TV.

## Architecture

**Two bundles** (`webpack.config.js`):

- `src/index.js` → `dist/index.js`: the app's launcher page (`src/index.html`). It waits for network (`wait-for-network.ts`), then `handleLaunch()` (`src/launch.js`) turns webOS launch params (deep links, DIAL/cast `contentTarget`, voice intents) into a `https://www.youtube.com/tv...` URL and navigates there.
- `src/userScript.ts` → `dist/webOSUserScripts/userScript.js`: webOS injects this into the YouTube TV web page (~3 s after page start, so anything YouTube does earlier is missed — see `hooks/json-parse.ts`). Everything the app adds lives here.

`assets/` is copied into `dist/`; `appinfo.json`'s `version` is overwritten from `package.json` at build time (`package.json` is the single source of the version; `__YTAF_VERSION__` is also injected).

**Feature modules are side-effect imports** listed in `src/userScript.ts`. Only the first few are ordered (polyfills, the `JSON.parse` hook, codec spoofing); a new feature = a new module + an import line + its option in `config.js`.

**Interception techniques** used across modules (understand these before changing behavior):

- Responses: `addResponseFilter(name, filter)` (`hooks/json-parse.ts`) registers a function that edits every InnerTube response (object with `responseContext`) YouTube gets from `JSON.parse`, in place; register at module top level, before any `await`. The hook wraps `JSON.parse` once, isolates each filter's exceptions, and also runs the filters on the home screen YouTube fetched before the userScript was injected (`window.pendingEarlyBrowse`). Never wrap `JSON.parse` in a module.
- `response-filters.js` (browser-free, tested) holds every "remove this from the response" rule: ads, Shorts, QR codes, sign-in prompts, "Most relevant", end screens. Each rule names the config option that switches it on; list items are dropped only from known feed lists (`FEED_LISTS`), walked once per response. `remove-content.ts` registers it. Other filters live with their feature (`subtitles.ts`, `thumbnail-quality.ts`, `disable-you-there.ts`, `video-codec.ts`).
- Requests: `adblock.ts` wraps `JSON.stringify` to set `isInlinePlaybackNoAd` on player requests. Objects may be frozen — copy, don't mutate, and never use `structuredClone` (it throws on values JSON accepts).
- `FetchRegistry` (`hooks/fetch.ts`): singleton wrapping `window.fetch`; modules listen for `request` events and can `preventDefault()` a request (e.g. `block-webos-cast.ts`).
- Player API (`player_api/`): `await getPlayerManager()` gives a `PlayerManager` that emits `newVideo` and `videoStart` (the first playback of each video outside a home screen preview); `player` is YouTube's internal player element (typed in `yt-api.ts`, undocumented). `video-quality.ts` is the one place that calls `setPlaybackQualityRange`.
- `ResolveCommandRegistry` (`app_api/`): hooks YouTube's internal command dispatcher by command name (`lang-settings-fix.ts`, `auto-account-select.ts`).
- `requireElement` (`dom.ts`) waits for an element YouTube hasn't created yet.
- `update-check.ts`: once a day fetches the fork's Homebrew repository (`__YTAF_UPDATE_URL__`, set at build time from `package.json` `repository` via `tools/repo-info.cjs`) and notifies when a newer version exists; the panel shows its status via `onUpdateStatus`.
- `CustomEventTarget` (`custom-event-target.ts`) is the typed event base class; it is backed by a `DocumentFragment` because `new EventTarget()` throws on old webOS.

**Config / settings UI**: options are declared once in `CONFIG_SECTIONS` in `src/config.js` (`key`, `default`, `desc`, `hint`; `children` for sub-options shown nested under the option they depend on; the SponsorBlock categories come from `sponsorblock-categories.js`), grouped by settings tab, and the panel (`ui.js`) is built from that list. Values are persisted in `localStorage` (only what the user changed; unset keys follow the default. Versions up to 0.6.0 saved every option on the first change, so a changed default doesn't reach those users). Read with `configRead(key)`, react with `configAddChangeListener(key, (newValue) => ...)`. Unknown keys throw. The panel handles arrow keys itself (tab bar, then up/down through the open section's options) instead of relying on the spatial-navigation polyfill, which skips options scrolled out of view. Remote color buttons go through `onColorKey()` (`remote-keys.js`): GREEN opens the panel, BLUE toggles audio-only mode (`audio-only.js`). `showNotification()` (`notifications.js`) shows toasts.

## Compatibility constraints

Targets range from webOS 1 (Safari 7 WebKit) to webOS 24 (Chrome 108) — see `.browserslistrc`. Babel + core-js polyfill syntax and builtins, and output must pass `test:compat` (ES5). Watch for DOM APIs that polyfills don't cover (e.g. `EventTarget` constructor, native `fetch` absent on webOS 3.x). Top-level `await` is allowed in modules (handled by `TransformAsyncModulesPlugin`). Don't use `devtool: 'eval'` (crashes old webOS).

## Fork workflow

- Upstream PRs are fetched as `refs/remotes/upstream/pr/<N>` (`git fetch upstream '+refs/pull/*/head:refs/remotes/upstream/pr/*'`). Merge them with `--no-ff` to keep contributor authorship, and credit each in `CHANGELOG.md` under the fork section.
- The app ID stays `youtube.leanback.v4` (required for the remote's YouTube button, casting and voice). The fork's version must stay higher than upstream's so Homebrew Channel doesn't treat upstream as an update.
- Release: push a `v*` tag. `.github/workflows/release.yml` builds, publishes the ipk + `youtube.leanback.v4.manifest.json` as a GitHub release, then runs `pnpm repo` (`tools/gen-repo.cjs`) and deploys `apps.json` (Homebrew Channel repository format) to GitHub Pages at `https://khalidmh.github.io/youtube-webos/apps.json`. Repo URLs in the manifest come from `repository` in `package.json` (`tools/repo-info.cjs`).
