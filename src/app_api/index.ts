// Adapted from https://github.com/reisxd/TizenTube/blob/522f83cc012d5b1c75181b651e084a3afa280323/mods/resolveCommand.js

declare global {
  interface Window {
    _yttv?: Record<string, unknown>;
  }
}

export type ResolveCommandPayload = Record<string, unknown>;

type ResolveCommand = (
  command: ResolveCommandPayload,
  extra?: unknown
) => unknown;

/** Replaces YouTube's handling of one command; `originalFn` is YouTube's. */
export type ResolveCommandHook = (
  originalFn: ResolveCommand,
  payload: ResolveCommandPayload,
  extra: unknown
) => unknown;

interface HookTarget {
  instance: { resolveCommand: ResolveCommand };
}

function isHookTarget(target: unknown): target is HookTarget {
  return (
    typeof target === 'function' &&
    'instance' in target &&
    typeof target.instance === 'object' &&
    typeof (target.instance as Record<string, unknown> | null)
      ?.resolveCommand === 'function'
  );
}

function findHookTarget() {
  for (const key in window._yttv) {
    const target = window._yttv[key];
    if (isHookTarget(target)) return target;
  }
  return null;
}

/** YouTube's app object appears whenever its scripts get to it: poll. */
function waitForHookTarget(): Promise<HookTarget> {
  return new Promise((resolve) => {
    const poll = () => {
      const target = findHookTarget();
      if (target) resolve(target);
      else setTimeout(poll, 0);
    };
    poll();
  });
}

class ResolveCommandRegistry {
  #originalFn: ResolveCommand;
  #cmds = new Map<string, ResolveCommandHook>();

  constructor(target: HookTarget) {
    this.#originalFn = target.instance.resolveCommand.bind(target.instance);
    target.instance.resolveCommand = this.#resolveCommand;
    console.debug('[ResolveCommandRegistry] Hooked:', this.#originalFn);
  }

  #resolveCommand = (command: ResolveCommandPayload, extra?: unknown) => {
    console.group('[ResolveCommandRegistry] Resolving');
    console.debug('Command:');
    console.debug(command);
    console.debug('Extra:');
    console.debug(extra);
    console.groupEnd();

    for (const key of Object.keys(command)) {
      const hook = this.#cmds.get(key);
      if (hook) return hook(this.#originalFn, command, extra);
    }

    return this.#originalFn(command, extra);
  };

  /** Routes every command that has a `command` key to `fn`. */
  setHook(command: string, fn: ResolveCommandHook) {
    if (this.#cmds.has(command)) {
      throw new Error(`${command} is already hooked`);
    }
    this.#cmds.set(command, fn);
  }
}

let instance: Promise<ResolveCommandRegistry> | null = null;

export function getResolveCommandRegistry(): Promise<ResolveCommandRegistry> {
  instance ??= waitForHookTarget().then(
    (target) => new ResolveCommandRegistry(target)
  );
  return instance;
}
