/**
 * Compares two dotted version strings ("0.6.10" vs "0.6.9") numerically.
 * Missing or non-numeric parts count as 0.
 * @param {string} a
 * @param {string} b
 * @returns {number} Positive if `a` is newer, negative if older, 0 if equal.
 */
export function compareVersions(a, b) {
  const partsA = String(a).split('.');
  const partsB = String(b).split('.');
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const x = parseInt(partsA[i] ?? '0', 10) || 0;
    const y = parseInt(partsB[i] ?? '0', 10) || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/**
 * @param {string} candidate
 * @param {string} current
 */
export function isNewerVersion(candidate, current) {
  return compareVersions(candidate, current) > 0;
}
