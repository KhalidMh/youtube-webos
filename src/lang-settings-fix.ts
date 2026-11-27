// Adapted from https://github.com/reisxd/TizenTube/blob/522f83cc012d5b1c75181b651e084a3afa280323/mods/resolveCommand.js

import { getResolveCommandRegistry, type ResolveCommandHook } from './app_api';

function getPrefsCookie() {
  const PREFIX = 'PREF=';

  let str = document.cookie.split('; ').find((x) => x.startsWith(PREFIX));
  if (!str) return new URLSearchParams();

  str = str.slice(PREFIX.length);
  return new URLSearchParams(str);
}

const hook: ResolveCommandHook = function (resolveCommand, payload, extra) {
  const settingDatas = (
    payload.setClientSettingEndpoint as { settingDatas?: unknown } | null
  )?.settingDatas;
  const setting = Array.isArray(settingDatas)
    ? settingDatas.find(
        (data) => data?.clientSettingEnum?.item === 'I18N_LANGUAGE'
      )
    : undefined;

  if (!setting) return resolveCommand(payload, extra);

  const lang = setting.stringValue;
  const date = new Date();
  date.setFullYear(date.getFullYear() + 10);

  const prefs = getPrefsCookie();
  prefs.set('hl', lang);
  document.cookie = `PREF=${prefs.toString()}; Domain=.youtube.com; expires=${date.toUTCString()};`;

  resolveCommand({
    signalAction: {
      signal: 'RELOAD_PAGE'
    }
  });

  return true;
};

(await getResolveCommandRegistry()).setHook('setClientSettingEndpoint', hook);
