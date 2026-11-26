import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareVersions, isNewerVersion } from '../src/version-compare.js';

test('compares each part numerically, not as text', () => {
  assert.equal(compareVersions('0.6.10', '0.6.9'), 1);
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
});

test('equal versions compare as 0, missing parts count as 0', () => {
  assert.equal(compareVersions('0.6.0', '0.6.0'), 0);
  assert.equal(compareVersions('0.6', '0.6.0'), 0);
  assert.equal(compareVersions('0.6.0.1', '0.6.0'), 1);
});

test('older versions compare negative', () => {
  assert.equal(compareVersions('0.5.3', '0.6.0'), -1);
});

test('non-numeric parts count as 0', () => {
  assert.equal(compareVersions('0.6.x', '0.6.0'), 0);
  assert.equal(compareVersions('', '0.0.0'), 0);
});

test('isNewerVersion is strict', () => {
  assert.equal(isNewerVersion('0.6.1', '0.6.0'), true);
  assert.equal(isNewerVersion('0.6.0', '0.6.0'), false);
  assert.equal(isNewerVersion('0.5.3', '0.6.0'), false);
});
