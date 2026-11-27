import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FILTER_OPTIONS } from '../src/response-filters.js';

// config.js reads localStorage and creates an event target when imported.
globalThis.window = { localStorage: { getItem: () => null } };
globalThis.document = {
  createDocumentFragment: () => ({ addEventListener() {} })
};
const { configRead } = await import('../src/config.js');

test('every option a response filter reads exists in the config', () => {
  // An unknown key makes the filter throw, which disables all of it.
  for (const option of FILTER_OPTIONS) {
    assert.equal(typeof configRead(option), 'boolean', option);
  }
});
