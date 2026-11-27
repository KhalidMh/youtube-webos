import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filterResponse } from '../src/response-filters.js';

const ALL = {
  enableAdBlock: true,
  removeShorts: true,
  removeQrCodes: true,
  hideSignInPrompts: true,
  removeMostRelevant: true,
  removeEndscreen: true
};
const NONE = {};

const tile = (id) => ({ tileRenderer: { contentId: id } });

const shortTile = (id) => ({
  tileRenderer: {
    contentId: id,
    onSelectCommand: { reelWatchEndpoint: { videoId: id } }
  }
});

const shelf = (title, items) => ({
  shelfRenderer: {
    title: { runs: [{ text: title }] },
    content: { horizontalListRenderer: { items } }
  }
});

const shelfTitles = (contents) =>
  contents.map((s) => s.shelfRenderer?.title.runs[0].text);

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

const sideMenu = (entries) => ({
  responseContext: {},
  items: [{ guideSectionRenderer: { items: entries } }]
});

const guideEntry = (title, navigationEndpoint = {}) => ({
  guideEntryRenderer: { title: { simpleText: title }, navigationEndpoint }
});

// Ads

test('removes the ads of a player response, keeping the video', () => {
  const response = {
    responseContext: {},
    streamingData: { formats: [] },
    adPlacements: [{}],
    adSlots: [{}],
    playerAds: [{}]
  };
  filterResponse(response, ALL);
  assert.deepEqual(response, {
    responseContext: {},
    streamingData: { formats: [] }
  });
});

test('removes the masthead and ad tiles from the home screen', () => {
  const response = browse([
    { tvMastheadRenderer: {} },
    { adSlotRenderer: {} },
    shelf('Recommended', [{ adSlotRenderer: {} }, tile('a')])
  ]);
  filterResponse(response, ALL);
  assert.deepEqual(sections(response), [shelf('Recommended', [tile('a')])]);
});

test('removes ad tiles from search results', () => {
  const response = {
    responseContext: {},
    contents: {
      sectionListRenderer: {
        contents: [{ adSlotRenderer: {} }, shelf('Results', [tile('a')])]
      }
    }
  };
  filterResponse(response, ALL);
  assert.deepEqual(response.contents.sectionListRenderer.contents, [
    shelf('Results', [tile('a')])
  ]);
});

test('removes ads between Shorts', () => {
  const ad = {
    command: { reelWatchEndpoint: { adClientParams: { isAd: true } } }
  };
  const short = { command: { reelWatchEndpoint: { videoId: 'a' } } };
  const response = { responseContext: {}, entries: [ad, short] };
  filterResponse(response, ALL);
  assert.deepEqual(response.entries, [short]);
});

test('keeps the ads with ad blocking off', () => {
  const make = () => ({
    ...browse([{ tvMastheadRenderer: {} }, shelf('Recommended', [tile('a')])]),
    adPlacements: [{}]
  });
  const response = make();
  filterResponse(response, { ...ALL, enableAdBlock: false });
  assert.deepEqual(response, make());
});

// Shorts

test('removes Shorts tiles from every grid', () => {
  const grid = (items) => ({ gridRenderer: { items } });
  const response = {
    responseContext: {},
    contents: {
      tabs: [grid([shortTile('s1'), tile('a')]), grid([shortTile('s2')])]
    }
  };
  filterResponse(response, ALL);
  assert.deepEqual(response.contents.tabs[0].gridRenderer.items, [tile('a')]);
  assert.deepEqual(response.contents.tabs[1].gridRenderer.items, []);
});

test('removes Shorts tiles from grid continuations', () => {
  const response = {
    responseContext: {},
    continuationContents: {
      gridContinuation: { items: [tile('a'), shortTile('s')] }
    }
  };
  filterResponse(response, ALL);
  assert.deepEqual(response.continuationContents.gridContinuation.items, [
    tile('a')
  ]);
});

test('removes Shorts shelves, and shelves left empty by it', () => {
  const shortsShelf = {
    shelfRenderer: {
      tvhtml5ShelfRendererType: 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS',
      content: { horizontalListRenderer: { items: [tile('a')] } }
    }
  };
  const response = subscriptions([
    shortsShelf,
    shelf('Only Shorts', [shortTile('s')]),
    shelf('Today', [tile('b')])
  ]);
  filterResponse(response, ALL);
  assert.deepEqual(shelfTitles(subscriptionSections(response)), ['Today']);
});

test('removes the Shorts entry of the side menu, keeping the others', () => {
  const response = sideMenu([
    guideEntry('Home'),
    guideEntry('Shorts', { reelWatchEndpoint: {} }),
    guideEntry('Sign in')
  ]);
  filterResponse(response, ALL);
  assert.deepEqual(response.items[0].guideSectionRenderer.items, [
    guideEntry('Home'),
    guideEntry('Sign in')
  ]);
});

test('keeps Shorts with the option off', () => {
  const response = browse([shelf('Mixed', [shortTile('s'), tile('a')])]);
  filterResponse(response, { ...ALL, removeShorts: false });
  assert.deepEqual(sections(response), [
    shelf('Mixed', [shortTile('s'), tile('a')])
  ]);
});

// QR codes

test('removes the QR code overlay, keeping the rest of the overlay', () => {
  for (const response of [
    { responseContext: {}, streamingData: {}, playerOverlays: watchOverlay() },
    {
      responseContext: {},
      contents: { singleColumnWatchNextResults: {} },
      playerOverlays: watchOverlay()
    }
  ]) {
    filterResponse(response, ALL);
    assert.deepEqual(response.playerOverlays.playerOverlayRenderer, {
      autoplay: { keep: true }
    });
  }
});

test('keeps the QR code overlay when the option is off', () => {
  const response = { responseContext: {}, playerOverlays: watchOverlay() };
  filterResponse(response, { ...ALL, removeQrCodes: false });
  assert.deepEqual(response.playerOverlays, watchOverlay());
});

// End screen

test('removes the end screen with the option on', () => {
  const make = () => ({
    responseContext: {},
    endscreen: { endscreenRenderer: { elements: [] } }
  });

  const on = make();
  filterResponse(on, ALL);
  assert.equal(on.endscreen, undefined);

  const off = make();
  filterResponse(off, { ...ALL, removeEndscreen: false });
  assert.deepEqual(off, make());
});

// Sign-in prompts

test('removes guest sign-in prompts from the home screen', () => {
  const response = browse([
    { feedNudgeRenderer: {} },
    shelf('Recommended', [tile('a'), tile('b')]),
    { alertWithActionsRenderer: {} }
  ]);
  filterResponse(response, ALL);
  assert.deepEqual(shelfTitles(sections(response)), ['Recommended']);
});

test('removes the sign-in tile from inside a shelf, keeping the videos', () => {
  const signInTile = {
    gridButtonRenderer: {
      title: { runs: [{ text: 'Sign in for better recommendations' }] }
    }
  };
  const response = browse([shelf('Recommended', [signInTile, tile('a')])]);
  filterResponse(response, ALL);
  assert.deepEqual(sections(response), [shelf('Recommended', [tile('a')])]);
});

test('drops a shelf that only held a sign-in prompt', () => {
  const response = browse([
    shelf('Sign in', [{ feedNudgeRenderer: {} }]),
    shelf('Recommended', [tile('a')])
  ]);
  filterResponse(response, ALL);
  assert.deepEqual(shelfTitles(sections(response)), ['Recommended']);
});

test('keeps an already empty shelf (not emptied by the filter)', () => {
  const response = browse([shelf('Loading', [])]);
  filterResponse(response, ALL);
  assert.deepEqual(sections(response), [shelf('Loading', [])]);
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
  filterResponse(response, ALL);
  assert.deepEqual(
    response.contents.singleColumnWatchNextResults.pivot.sectionListRenderer
      .contents,
    [shelf('Up next', [tile('a')])]
  );
});

test('removes prompts from continuation item actions', () => {
  const response = {
    responseContext: {},
    onResponseReceivedActions: [
      {
        appendContinuationItemsAction: {
          continuationItems: [{ feedNudgeRenderer: {} }, tile('a')]
        }
      }
    ]
  };
  filterResponse(response, ALL);
  assert.deepEqual(
    response.onResponseReceivedActions[0].appendContinuationItemsAction
      .continuationItems,
    [tile('a')]
  );
});

test('sign-in prompts are only removed from content feeds', () => {
  // The same components outside a feed (e.g. a sign-in or account screen)
  // must survive, so signing in keeps working.
  const make = () => ({
    responseContext: {},
    contents: {
      signInScreen: {
        alerts: [{ alertWithActionsRenderer: { title: 'Sign in' } }],
        nudges: [{ feedNudgeRenderer: {} }],
        buttons: [
          {
            gridButtonRenderer: {
              title: { runs: [{ text: 'Sign in for better recommendations' }] }
            }
          }
        ]
      }
    }
  });
  const response = make();
  filterResponse(response, ALL);
  assert.deepEqual(response, make());
});

// "Most relevant"

test('removes the "Most relevant" shelf from subscriptions', () => {
  const response = subscriptions([
    shelf('Most relevant', [tile('a')]),
    shelf('Today', [tile('b')])
  ]);
  filterResponse(response, ALL);
  assert.deepEqual(shelfTitles(subscriptionSections(response)), ['Today']);
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
  filterResponse(response, ALL);
  assert.deepEqual(shelfTitles(subscriptionSections(response)), ['Today']);
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
  filterResponse(response, ALL);
  assert.deepEqual(
    shelfTitles(response.continuationContents.sectionListContinuation.contents),
    ['Older']
  );
});

// Options and robustness

test('each option only removes its own content', () => {
  const make = () =>
    browse([
      { feedNudgeRenderer: {} },
      shelf('Most relevant', [tile('a')]),
      shelf('Today', [tile('b')])
    ]);

  const promptsOnly = make();
  filterResponse(promptsOnly, { hideSignInPrompts: true });
  assert.deepEqual(shelfTitles(sections(promptsOnly)), [
    'Most relevant',
    'Today'
  ]);

  const mostRelevantOnly = make();
  filterResponse(mostRelevantOnly, { removeMostRelevant: true });
  assert.equal(sections(mostRelevantOnly).length, 2);
  assert.ok(sections(mostRelevantOnly)[0].feedNudgeRenderer);
});

test('leaves everything alone with every option off', () => {
  const make = () => ({
    ...browse([
      { feedNudgeRenderer: {} },
      { adSlotRenderer: {} },
      shelf('Most relevant', [shortTile('s')])
    ]),
    adPlacements: [{}],
    endscreen: { endscreenRenderer: {} },
    playerOverlays: watchOverlay()
  });
  const response = make();
  filterResponse(response, NONE);
  assert.deepEqual(response, make());
});

test('ignores non-object values', () => {
  for (const value of [null, undefined, 1, 'text', true]) {
    assert.doesNotThrow(() => filterResponse(value, ALL));
  }
});
