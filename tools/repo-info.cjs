// The GitHub repository releases are published from, as `owner/name`.
// Taken from `repository` in package.json (e.g. `github:owner/name`).

const pkgJson = require('../package.json');

const match = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(pkgJson.repository);
if (!match) {
  throw new Error(
    `package.json "repository" must look like github:owner/name, got ${pkgJson.repository}`
  );
}

const repoSlug = /** @type {string} */ (match[1]);

module.exports = { repoSlug };
