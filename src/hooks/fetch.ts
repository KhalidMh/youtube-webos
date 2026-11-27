import { CustomEventTarget, TypedCustomEvent } from '../custom-event-target';

type FetchTarget = Request | { toString(): string };

let registry: FetchRegistry | null = null;

interface EventMap {
  /** Cancelable: `preventDefault()` makes the request fail. */
  request: CustomEvent<{ url: URL }>;
}

export class FetchRegistry extends CustomEventTarget<EventMap> {
  #originalFetch: typeof fetch;
  #fetchCount = 0;

  private constructor() {
    super();

    this.#originalFetch = window.fetch.bind(window);
    window.fetch = this.#customFetch;
  }

  static async #dumpBody(resource: Request | Response) {
    if (
      !resource?.constructor?.name ||
      !['Request', 'Response'].includes(resource.constructor.name)
    )
      return null;

    const blob = await resource.clone().blob();
    if (!blob.size) return null;

    const fr = new FileReader();

    const res = new Promise((resolve) => {
      fr.addEventListener('load', () => {
        resolve(fr.result);
      });
    });

    fr.readAsDataURL(blob);

    return res;
  }

  #customFetch = async (resource: FetchTarget, init?: RequestInit) => {
    if (window.__ytaf_debug__) {
      console.debug(`Request ${this.#fetchCount}:`, resource);
      init && console.debug(`Options  ${this.#fetchCount}:`, init);

      if (resource instanceof Request) {
        const reqBody = await FetchRegistry.#dumpBody(resource);
        reqBody && console.debug(`Request Body ${this.#fetchCount}:`, reqBody);
      }
    }

    const url = new URL(
      resource instanceof Request ? resource.url : resource.toString(),
      document.location.href
    );
    const reqAllowed = this.dispatchEvent(
      new TypedCustomEvent('request', {
        detail: { url },
        cancelable: true
      })
    );
    if (!reqAllowed) {
      console.info(
        `Fetch request ${this.#fetchCount} was cancelled by listener.`,
        resource,
        init
      );
      throw new TypeError('Failed to fetch');
    }

    // @ts-expect-error
    const res = await this.#originalFetch(resource, init);

    if (window.__ytaf_debug__) {
      console.debug(`Response ${this.#fetchCount}:`, res);

      const resBody = await FetchRegistry.#dumpBody(res);
      resBody && console.debug(`Response Body ${this.#fetchCount}:`, resBody);
    }

    this.#fetchCount++;

    return res;
  };

  static getInstance() {
    if (!registry) {
      registry = new FetchRegistry();
    }
    return registry;
  }
}
