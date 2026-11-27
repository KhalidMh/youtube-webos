import { configRead } from './config';

import { getResolveCommandRegistry, type ResolveCommandHook } from './app_api';

const hook: ResolveCommandHook = function (resolveCommand, payload, extra) {
  if (!configRead('autoAccountSelect')) return resolveCommand(payload, extra);

  const finalEndpoint = (
    payload.startAccountSelectorCommand as { nextEndpoint?: unknown } | null
  )?.nextEndpoint;

  resolveCommand({
    onIdentityChanged: {
      identityActionContext: {
        nextEndpoint: finalEndpoint,
        eventTrigger: 'ACCOUNT_EVENT_TRIGGER_WHOS_WATCHING',
        reloadRequired: undefined
      },
      isSameIdentity: true
    },
    commandMetadata: { webCommandMetadata: { clientAction: true } }
  });
};

(await getResolveCommandRegistry()).setHook(
  'startAccountSelectorCommand',
  hook
);
