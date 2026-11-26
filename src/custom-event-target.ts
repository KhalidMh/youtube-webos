type TypedEventPartial<T extends EventTarget, U> = {
  readonly currentTarget: T | null;
  readonly type: U;
};

type BaseTypedEvent<T extends EventTarget, E extends Event, U> = E &
  TypedEventPartial<T, U>;

type EventInstanceType<T, O> = T extends abstract new (
  type: string,
  options?: O
) => infer R
  ? R
  : never;

type EventOptionsType<T> = T extends new (
  type: string,
  options?: infer O
) => Event
  ? O
  : never;

export function asTypedEvent<
  const E extends Event,
  const A = EventInit
>(event: { new (type: string, options?: A): E }) {
  return event as {
    new <
      T extends EventTarget,
      const U,
      const O extends EventOptionsType<typeof event>
    >(
      type: U,
      options?: O
    ): BaseTypedEvent<T, EventInstanceType<typeof event, O>, U>;
    prototype: BaseTypedEvent<EventTarget, E, string>;
  };
}

export type TypedEvent<T extends EventTarget, U> = BaseTypedEvent<T, Event, U>;
export const TypedEvent = asTypedEvent(Event);

export type TypedCustomEvent<
  D,
  T extends EventTarget,
  U = string
> = BaseTypedEvent<T, CustomEvent<D>, U>;

export const TypedCustomEvent = CustomEvent as {
  new <const U extends string, const D = undefined>(
    type: U,
    eventInitDict?: CustomEventInit<D>
  ): TypedCustomEvent<D, EventTarget, U>;

  prototype: BaseTypedEvent<EventTarget, CustomEvent<unknown>, string>;
};

interface EmptyEventMap {}

type EventMapValue<
  T extends EmptyEventMap,
  K extends keyof T & string
> = T[K] extends Event ? T[K] : never;

interface EventListener<
  Self extends EventTarget,
  T extends EmptyEventMap,
  EventName extends keyof T
> {
  (this: Self, evt: T[EventName] & TypedEvent<Self, EventName>): void;
}

interface EventListenerObject<
  Self extends EventTarget,
  T extends EmptyEventMap,
  EventName extends keyof T
> {
  handleEvent: EventListener<Self, T, EventName>;
}

type EventListenerArg<
  Self extends EventTarget,
  T extends EmptyEventMap,
  EventName extends keyof T
> =
  | EventListener<Self, T, EventName>
  | EventListenerObject<Self, T, EventName>
  | null;

interface CustomEventTarget<T extends EmptyEventMap> {
  addEventListener<K extends keyof T & string>(
    type: K,
    callback: EventListenerArg<this, T, K>,
    options?: boolean | AddEventListenerOptions
  ): void;

  removeEventListener<K extends keyof T & string>(
    type: K,
    callback: EventListenerArg<this, T, K>,
    options?: boolean | EventListenerOptions
  ): void;

  dispatchEvent<K extends keyof T & string>(
    event: EventMapValue<T, K>
  ): boolean;
}

/**
 * `new EventTarget()` throws "Illegal constructor" before Chromium 64
 * (webOS 3.x/4.x), so listeners live on a `DocumentFragment` instead.
 *
 * Listener functions are wrapped so that their `this` is this object, as with
 * a real `EventTarget`: handlers such as `video-quality.ts` read `this.player`.
 * `event.currentTarget` is still the fragment.
 */
type ListenerFunction = (evt: Event) => void;

class FragmentEventTarget implements EventTarget {
  private readonly target = document.createDocumentFragment();

  /** Wrapper per listener function, per `type` and capture flag. */
  private readonly wrappers = new WeakMap<
    ListenerFunction,
    Map<string, ListenerFunction>
  >();

  private wrapperFor(
    type: string,
    callback: ListenerFunction,
    options: boolean | EventListenerOptions | undefined,
    create: boolean
  ) {
    const capture =
      typeof options === 'boolean' ? options : Boolean(options?.capture);
    const key = `${capture}:${type}`;

    let byKey = this.wrappers.get(callback);
    if (!byKey) {
      if (!create) return undefined;
      byKey = new Map();
      this.wrappers.set(callback, byKey);
    }

    let wrapper = byKey.get(key);
    if (!wrapper && create) {
      wrapper = (evt: Event) => callback.call(this, evt);
      byKey.set(key, wrapper);
    }
    return wrapper;
  }

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    // An object's `handleEvent` is already called with the object as `this`.
    const listener =
      typeof callback === 'function'
        ? this.wrapperFor(type, callback, options, true)
        : callback;
    this.target.addEventListener(type, listener ?? null, options);
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    const listener =
      typeof callback === 'function'
        ? this.wrapperFor(type, callback, options, false)
        : callback;
    if (listener) this.target.removeEventListener(type, listener, options);
  }

  dispatchEvent(event: Event): boolean {
    return this.target.dispatchEvent(event);
  }
}

export const CustomEventTarget = FragmentEventTarget as unknown as {
  new <T extends EmptyEventMap>(): CustomEventTarget<T>;
  prototype: CustomEventTarget<EmptyEventMap>;
};

export type EventMapOf<T> =
  T extends CustomEventTarget<infer U>
    ? { [K in keyof U]: U[K] & TypedEvent<T, K> }
    : never;
