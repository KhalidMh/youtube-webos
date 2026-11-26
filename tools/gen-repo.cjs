#!/usr/bin/env node

// Generates a Homebrew Channel repository (`apps.json`) listing this fork, in
// the same format as https://repo.webosbrew.org/api/apps.json. Users add the
// URL it is served from in Homebrew Channel: Settings > Add repository.
//
// Usage: gen-repo <manifest.json> <outdir>

const fs = require('fs');
const path = require('path');

const { repoSlug } = require('./repo-info.cjs');

const [manifestFile, outdir] = process.argv.slice(2);
if (!manifestFile || !outdir)
  throw new Error('Usage: gen-repo <manifest.json> <outdir>');

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const releaseUrl = `https://github.com/${repoSlug}/releases/download/v${manifest.version}`;
const ipkFile = path.basename(manifest.ipkUrl);

const fullDescription = `<p><b>BE SURE TO UNINSTALL THE OFFICIAL YOUTUBE TV APP BEFORE INSTALLING</b></p>
<p>YouTube TV app with extended functionalities: ad blocking, SponsorBlock, Shorts removal and more.
Community-maintained fork of webosbrew/youtube-webos that merges community fixes.</p>
<p>The configuration screen opens with the GREEN button on the remote.</p>
<p>Source: <a href="https://github.com/${repoSlug}">github.com/${repoSlug}</a></p>
`;

const entry = {
  id: manifest.id,
  title: `${manifest.title} (community fork)`,
  iconUri: manifest.iconUri,
  manifestUrl: `${releaseUrl}/${path.basename(manifestFile)}`,
  manifest: {
    ...manifest,
    ipkUrl: `${releaseUrl}/${ipkFile}`,
    ipkSize: fs.statSync(ipkFile).size
  },
  pool: 'main',
  shortDescription: 'Ad-free YouTube with community fixes',
  fullDescriptionUrl: `apps/${manifest.id}/full_description.html`
};

const descDir = path.join(outdir, 'apps', manifest.id);
fs.mkdirSync(descDir, { recursive: true });
fs.writeFileSync(path.join(descDir, 'full_description.html'), fullDescription);
fs.writeFileSync(
  path.join(outdir, 'apps.json'),
  JSON.stringify({
    paging: {
      page: 1,
      count: 1,
      maxPage: 1,
      itemsTotal: 1,
      prevUrl: null,
      nextUrl: null
    },
    packages: [entry]
  })
);
console.info(`Wrote ${path.join(outdir, 'apps.json')}`);
