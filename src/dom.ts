/**
 * `document.querySelector`, but waits for the element to be added (or to
 * start matching after an attribute change) if it isn't there yet.
 */
export function requireElement<E extends typeof Element>(
  cssSelectors: string,
  expected: E
): Promise<InstanceType<E>> {
  const check = (node: unknown) => {
    if (!(node instanceof expected)) {
      throw new Error(`${cssSelectors} is not a ${expected.name}`);
    }
    // Cast required due to narrowing limitations.
    // https://github.com/microsoft/TypeScript/issues/55241
    return node as InstanceType<E>;
  };

  const alreadyPresent = document.querySelector(cssSelectors);
  if (alreadyPresent) return Promise.resolve(check(alreadyPresent));

  return new Promise((resolve, reject) => {
    const matches = (node: Node): node is Element =>
      node instanceof Element && node.matches(cssSelectors);

    const found = (node: Element) => {
      obs.disconnect();
      try {
        resolve(check(node));
      } catch (err) {
        reject(err as Error);
      }
    };

    const obs = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        if (mut.type === 'attributes') {
          if (matches(mut.target)) return found(mut.target);
        } else {
          for (const node of Array.from(mut.addedNodes)) {
            if (matches(node)) return found(node);
          }
        }
      }
    });

    obs.observe(document.body, {
      subtree: true,
      attributes: true,
      childList: true
    });
  });
}
