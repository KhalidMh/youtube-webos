<h1 align="center">
  YouTube Ad-Free
</h1>
<p align="center">
  YouTube for LG TVs, without ads.
</p>
<p align="center">
  <img src="https://img.shields.io/github/v/release/KhalidMh/youtube-webos?style=flat-square" alt="Latest Release">
  <img src="https://img.shields.io/github/downloads/KhalidMh/youtube-webos/total?style=flat-square" alt="Total Downloads">
  <img src="https://img.shields.io/badge/LG-webOS-000000?logo=webos&logoColor=white&style=flat-square" alt="webOS">
</p>

This app replaces the YouTube app on your LG TV. It looks and works like the normal one, but it blocks ads, skips sponsor segments and hides Shorts. Your remote's YouTube button, casting from your phone and voice search all still work.

It's a community-maintained version of [webosbrew/youtube-webos](https://github.com/webosbrew/youtube-webos), with fixes and features the original never added. See the [changelog](CHANGELOG.md) for what's new.

![Configuration Screen](./screenshots/1_sm.jpg?raw=true)
![Segment Skipped](./screenshots/2_sm.jpg?raw=true)

---

## What it does

**Works right away:**

- **No ads.**
- **Skips sponsor segments** in videos, using [SponsorBlock](https://sponsor.ajay.app/): sponsors, intros, outros, "subscribe" reminders and self-promotion.
- **No "Continue watching?" pop-up** stopping your video.
- **Hides clutter:** shopping QR codes during videos, and "Sign in" banners when you're not signed in.
- **Audio only:** press the 🟦 **Blue** button to play just the sound.
- **Tells you when there's an update.**

**Turn on in the settings if you want them:**

- **Hide Shorts** everywhere, including the side menu.
- **Always play at the highest quality**, and show sharper thumbnails.
- **Hide more:** end screens, the YouTube logo, and the "Most relevant" row in Subscriptions.
- **On-screen clock.**
- **English subtitles** on any video, auto-translated.
- **Live streams catch up** to live automatically.
- **Skip the "Who's watching?" screen.**

Press the 🟩 **Green** button on your remote to open the settings. Everything above can be turned on or off there.

---

## How to install

LG only lets you install apps from its own store, so you have to unlock your TV first. There are two ways:

|           | **Developer Mode**                                                             | **Rooting**                                          |
| --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Works on  | Almost every LG TV from the last few years                                     | Only some models and software versions               |
| You need  | A free LG developer account and a computer                                     | A computer, and a rooting tool that works on your TV |
| The catch | Apps are **removed after 1000 hours** (about 6 weeks) unless you reset a timer | None: apps stay installed                            |

**Not sure? Use Developer Mode.** To see if your TV can be rooted, check [cani.rootmy.tv](https://cani.rootmy.tv).

> [!IMPORTANT]
> Uninstall the official YouTube app before you start, if your TV lets you.

### Step 1: Unlock your TV

**With Developer Mode:** follow [Set up Developer Mode](#set-up-developer-mode) below.

**With rooting:** follow the [webOS Homebrew rooting guide](https://www.webosbrew.org/rooting/).

### Step 2: Install Homebrew Channel

Homebrew Channel is a free app store for apps like this one. It's the easiest way to install this app and keep it up to date.

- **Rooted TV:** nothing to do. Rooting installs it for you.
- **Developer Mode:**
  1. On your computer, download and open [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop/releases/latest).
  2. Add your TV in Dev Manager (it asks for the TV's IP address, which the Developer Mode app shows).
  3. Find **Homebrew Channel** in Dev Manager's app list and install it.

### Step 3: Install YouTube Ad-Free

1. On your TV, open **Homebrew Channel**.
2. Go to **Settings** and choose **Add repository**.
3. Type this address and confirm:

   ```
   https://khalidmh.github.io/youtube-webos/apps.json
   ```

4. Go back to the app list and install **YouTube AdFree (community fork)**.

That's it. Open the app from your TV's home screen or press the YouTube button on your remote.

> [!WARNING]
> Homebrew Channel also lists an app called just **YouTube AdFree**, without "(community fork)". That's the original version. Don't install or update it: it replaces this one.

### Set up Developer Mode

You only need this if you're not rooting your TV. (Steps from [webosbrew.org/devmode](https://www.webosbrew.org/devmode).)

1. On your computer or phone, create a free account on the [LG Developer site](https://webostv.developer.lge.com/login) and confirm your email.
2. On the TV, open the **LG Content Store**, search for **Developer Mode** and install it.
3. Open the Developer Mode app, sign in with your new account and turn on **Dev Mode Status**. The TV restarts.
4. Open the Developer Mode app again and turn on **Key Server**. Write down the **IP address** it shows; Dev Manager asks for it.

Then go back to [Step 2](#step-2-install-homebrew-channel).

> [!NOTE]
> **Don't let the timer run out.** The Developer Mode app shows how much time is left. When it reaches zero, the TV removes this app and Homebrew Channel. Open the Developer Mode app every few weeks and reset the timer. Dev Manager can also [do this for you automatically](https://github.com/webosbrew/dev-manager-desktop#scheduled-developer-mode-renewal).

### Another way: install the file yourself

If you don't want Homebrew Channel, download the `.ipk` file from the [latest release](https://github.com/KhalidMh/youtube-webos/releases/latest) and install it with [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop). You'll have to repeat this for every update.

---

## Using the app

- **Settings:** press the 🟩 **Green** button.
  - **Left / right** switches between the **Content**, **Playback**, **SponsorBlock** and **Interface** tabs.
  - **Down / up** moves through the options.
  - **OK** turns an option on or off. Changes apply right away.
  - Press **Green** again to close.
- **Audio only:** press the 🟦 **Blue** button.
- **Updates:** when a new version is out, the app shows a message. Open Homebrew Channel and update **YouTube AdFree (community fork)**.

---

## Advanced: start automatically

You can make the app start with the TV, as if it were an input source. This needs a command run on the TV over **SSH** or **Telnet** (usually on a rooted TV):

```sh
luna-send-pub -n 1 'luna://com.webos.service.eim/addDevice' '{"appId":"youtube.leanback.v4","pigImage":"","mvpdIcon":""}'
```

The app then starts automatically if it was the last app you used, and stays loaded in the background so it opens faster. This uses a little more memory.

To turn it off:

```sh
luna-send-pub -n 1 'luna://com.webos.service.eim/deleteDevice' '{"appId":"youtube.leanback.v4"}'
```

---

## For developers

### Prerequisites

- The latest **Node.js** LTS release. See `devEngines` in [`package.json`](package.json) for the minimum version.
- **pnpm**. If you already have Node.js, run `corepack enable` to set it up.
- **git**

### Setup

```sh
git clone https://github.com/KhalidMh/youtube-webos.git
cd youtube-webos
pnpm install
```

### Building an IPK

```sh
pnpm build      # or `pnpm build:dev` for a development build with source maps
pnpm package
```

The `.ipk` file is written to the project root. You can install it with [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop), or set up the CLI below to install it with one command.

### Add the TV to the CLI

Unlock your TV with [Developer Mode](#set-up-developer-mode) first. If your TV is rooted, follow [the rooted TV setup](#rooted-tv-setup) instead.

```sh
pnpm exec ares-setup-device
```

Follow the prompts:

1. Add device
2. Enter the IP address shown in the Developer Mode app
3. Use the default values unless you need something else
4. Enter the 6-digit passphrase shown on the TV

Check that it worked:

```sh
pnpm exec ares-setup-device --list
```

Sample output:

```log
name            deviceinfo                     connection  profile    passphrase
--------------  -----------------------------  ----------  -------    ----------
mytv (default)  prisoner@192.168.137.102:9922  ssh         tv         EF32E8
```

### Rooted TV setup

1. Enable SSH in Homebrew Channel.
2. Generate an SSH key:

   ```sh
   ssh-keygen -t rsa
   ```

3. Copy `id_rsa` to `~/.ssh` (Windows: `%USERPROFILE%\.ssh`).
4. Append `id_rsa.pub` to `/home/root/.ssh/authorized_keys` on the TV.
5. Add the device:

   ```sh
   pnpm exec ares-setup-device -a webos \
     -i "username=root" \
     -i "privatekey=id_rsa" \
     -i "passphrase=SSH_KEY_PASSPHRASE" \
     -i "host=TV_IP" \
     -i "port=22"
   ```

### Installing, launching and debugging

```sh
pnpm deploy     # install the .ipk on the default device
pnpm launch     # start the app
pnpm inspect    # print a DevTools URL for the app's console
```

All in one:

```sh
pnpm build && pnpm package && pnpm deploy && pnpm launch
```

To open a specific video directly:

```sh
pnpm launch -p '{"contentTarget":"v=F8PGWLvn1mQ"}'
```

For a device other than the default one, use the webOS CLI directly, for example `pnpm exec ares-inspect -d <device_name> --app youtube.leanback.v4`.

### Checks

```sh
pnpm lint:all       # eslint, tsc and prettier
pnpm test           # unit tests
pnpm test:compat    # build output must be ES5 (run after a build)
```
