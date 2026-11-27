/**
 * A typed `EventTarget` for the app's own events, e.g.
 * `class Foo extends CustomEventTarget<{ ready: CustomEvent<number> }>`.
 *
 * `new EventTarget()` throws "Illegal constructor" before Chromium 64
 * (webOS 3.x/4.x), so listeners live on a `DocumentFragment` instead.
 */
export class CustomEventTarget<T extends Record<keyof T, Event>> {
  readonly #target = document.createDocumentFragment();

  addEventListener<K extends keyof T & string>(
    type: K,
    listener: (evt: T[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) {
    this.#target.addEventListener(type, listener as EventListener, options);
  }

  dispatchEvent<K extends keyof T & string>(event: T[K] & { type: K }) {
    return this.#target.dispatchEvent(event);
  }
}

/** `CustomEvent`, typed with its event name. */
export const TypedCustomEvent = CustomEvent as new <
  const U extends string,
  const D = undefined
>(
  type: U,
  eventInitDict?: CustomEventInit<D>
) => CustomEvent<D> & { type: U };
