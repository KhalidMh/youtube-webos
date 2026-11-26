import assert from 'node:assert/strict';
import { test } from 'node:test';

import { removeClutter } from '../src/clutter-filters.js';

const ALL = {
  removeQrCodes: true,
  hideSignInPrompts: true,
  removeMostRelevant: true
};
const NONE = {
  removeQrCodes: false,
  hideSignInPrompts: false,
  removeMostRelevant: false
};

const tile = (id) => ({ tileRenderer: { contentId: id } });

const shelf = (title, items) => ({
  shelfRenderer: {
    title: { runs: [{ text: title }] },
    content: { horizontalListRenderer: { items } }
  }
});

/** A home/browse response with a section list, in the TV app's nesting. */
const browse = (contents) => ({
  responseContext: {},
  contents: {
    tvBrowseRenderer: {
      content: {
        tvSurfaceContentRenderer: {
          content: { sectionListRenderer: { contents } }
        }
      }
    }
  }
});

const sections = (response) =>
  response.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content
    .sectionListRenderer.contents;

/** A subscriptions page: a browse response with secondary-nav tabs. */
const subscriptions = (contents) => ({
  responseContext: {},
  contents: {
    tvBrowseRenderer: {
      content: {
        tvSecondaryNavRenderer: {
          sections: [
            {
              tvSecondaryNavSectionRenderer: {
                tabs: [
                  {
                    tabRenderer: {
                      content: {
                        tvSurfaceContentRenderer: {
                          content: { sectionListRenderer: { contents } }
                        }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    }
  }
});

const subscriptionSections = (response) =>
  response.contents.tvBrowseRenderer.content.tvSecondaryNavRenderer.sections[0]
    .tvSecondaryNavSectionRenderer.tabs[0].tabRenderer.content
    .tvSurfaceContentRenderer.content.sectionListRenderer.contents;

const watchOverlay = () => ({
  playerOverlayRenderer: {
    timelyActionRenderers: [{ timelyActionRenderer: { qr: true } }],
    autoplay: { keep: true }
  }
});

test('removes the QR code overlay from a player response', () => {
  const response = {
    responseContext: {},
    streamingData: {},
    playerOverlays: watchOverlay()
  };
  const result = removeClutter(response, ALL);
  assert.equal(result.qrCodes, true);
  assert.equal(
    response.playerOverlays.playerOverlayRenderer.timelyActionRenderers,
    undefined
  );
  // The rest of the overlay stays.
  assert.deepEqual(response.playerOverlays.playerOverlayRenderer.autoplay, {
    keep: true
  });
});

test('removes the QR code overlay from a next response', () => {
  const response = {
    responseContext: {},
    contents: { singleColumnWatchNextResults: {} },
    playerOverlays: watchOverlay()
  };
  assert.equal(removeClutter(response, ALL).qrCodes, true);
});

test('keeps the QR code overlay when the option is off', () => {
  const response = { responseContext: {}, playerOverlays: watchOverlay() };
  removeClutter(response, { ...ALL, removeQrCodes: false });
  assert.ok(
    response.playerOverlays.playerOverlayRenderer.timelyActionRenderers
  );
});

test('removes guest sign-in prompts from the home screen', () => {
  const response = browse([
    { feedNudgeRenderer: {} },
    shelf('Recommended', [tile('a'), tile('b')]),
    { alertWithActionsRenderer: {} }
  ]);
  const result = removeClutter(response, ALL);
  assert.equal(result.items, 2);
  assert.deepEqual(
    sections(response).map((s) => s.shelfRenderer?.title.runs[0].text),
    ['Recommended']
  );
});

test('removes the sign-in tile from inside a shelf, keeping the videos', () => {
  const signInTile = {
    gridButtonRenderer: {
      title: { runs: [{ text: 'Sign in for better recommendations' }] }
    }
  };
  const response = browse([shelf('Recommended', [signInTile, tile('a')])]);
  removeClutter(response, ALL);
  const items =
    sections(response)[0].shelfRenderer.content.horizontalListRenderer.items;
  assert.deepEqual(items, [tile('a')]);
});

test('drops a shelf that only held a sign-in prompt', () => {
  const response = browse([
    shelf('Sign in', [{ feedNudgeRenderer: {} }]),
    shelf('Recommended', [tile('a')])
  ]);
  removeClutter(response, ALL);
  assert.equal(sections(response).length, 1);
  assert.equal(
    sections(response)[0].shelfRenderer.title.runs[0].text,
    'Recommended'
  );
});

test('keeps an already empty shelf (not emptied by the filter)', () => {
  const response = browse([shelf('Loading', [])]);
  removeClutter(response, ALL);
  assert.equal(sections(response).length, 1);
});

test('removes guest prompts from the watch-next pivot', () => {
  const response = {
    responseContext: {},
    contents: {
      singleColumnWatchNextResults: {
        pivot: {
          sectionListRenderer: {
            contents: [
              { alertWithActionsRenderer: {} },
              shelf('Up next', [tile('a')])
            ]
          }
        }
      }
    }
  };
  removeClutter(response, ALL);
  const contents =
    response.contents.singleColumnWatchNextResults.pivot.sectionListRenderer
      .contents;
  assert.equal(contents.length, 1);
  assert.ok(contents[0].shelfRenderer);
});

test('removes the "Most relevant" shelf from subscriptions', () => {
  const response = subscriptions([
    shelf('Most relevant', [tile('a')]),
    shelf('Today', [tile('b')])
  ]);
  removeClutter(response, ALL);
  assert.deepEqual(
    subscriptionSections(response).map(
      (s) => s.shelfRenderer.title.runs[0].text
    ),
    ['Today']
  );
});

test('matches a "Most relevant" title given in the shelf header', () => {
  const response = subscriptions([
    {
      shelfRenderer: {
        headerRenderer: {
          shelfHeaderRenderer: {
            avatarLockup: {
              avatarLockupRenderer: { title: { simpleText: 'Most relevant' } }
            }
          }
        },
        content: { horizontalListRenderer: { items: [tile('a')] } }
      }
    },
    shelf('Today', [tile('b')])
  ]);
  removeClutter(response, ALL);
  assert.equal(subscriptionSections(response).length, 1);
});

test('removes "Most relevant" from a continuation', () => {
  const response = {
    responseContext: {},
    continuationContents: {
      sectionListContinuation: {
        contents: [shelf('Most relevant', [tile('a')]), shelf('Older', [])]
      }
    }
  };
  removeClutter(response, ALL);
  assert.equal(
    response.continuationContents.sectionListContinuation.contents.length,
    1
  );
});

test('each option only removes its own clutter', () => {
  const make = () =>
    browse([
      { feedNudgeRenderer: {} },
      shelf('Most relevant', [tile('a')]),
      shelf('Today', [tile('b')])
    ]);

  const promptsOnly = make();
  removeClutter(promptsOnly, { ...NONE, hideSignInPrompts: true });
  assert.equal(sections(promptsOnly).length, 2);
  assert.equal(
    sections(promptsOnly)[0].shelfRenderer.title.runs[0].text,
    'Most relevant'
  );

  const mostRelevantOnly = make();
  removeClutter(mostRelevantOnly, { ...NONE, removeMostRelevant: true });
  assert.equal(sections(mostRelevantOnly).length, 2);
  assert.ok(sections(mostRelevantOnly)[0].feedNudgeRenderer);
});

test('leaves everything alone with every option off', () => {
  const response = browse([
    { feedNudgeRenderer: {} },
    shelf('Most relevant', [tile('a')])
  ]);
  const before = structuredClone(response);
  assert.deepEqual(removeClutter(response, NONE), { qrCodes: false, items: 0 });
  assert.deepEqual(response, before);
});

test('does not walk player responses for list items', () => {
  const response = {
    responseContext: {},
    streamingData: { adaptiveFormats: [{ feedNudgeRenderer: {} }] }
  };
  removeClutter(response, ALL);
  assert.equal(response.streamingData.adaptiveFormats.length, 1);
});

test('ignores non-object values', () => {
  for (const value of [null, undefined, 1, 'text', true]) {
    assert.deepEqual(removeClutter(value, ALL), { qrCodes: false, items: 0 });
  }
});

test('survives a cyclic value', () => {
  const response = browse([shelf('Today', [tile('a')])]);
  response.self = response;
  assert.doesNotThrow(() => removeClutter(response, ALL));
});
