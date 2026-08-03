/**
 * Configuration for cached dataset statistics.
 */

/**
 * Cache generation for precomputed numeric statistics.
 *
 * Stamped onto `dataset.precomputedStats.numericVersion` by every producer and
 * checked at the hydration boundary. A stored blob whose version is absent or
 * lower is dropped and recomputed, because its numbers were produced by an
 * older, incorrect implementation.
 *
 * Bump this whenever `calculateStatistics` changes which values it counts or
 * how it aggregates them. Categorical stats are versioned separately (they are
 * not, currently) so they survive a numeric-only bump.
 *
 * 1: initial. Blank cells in a numeric column were counted, so `min` could
 *    return an empty string and `mean`/`median`/`n` were skewed toward zero.
 */
export const STATS_NUMERIC_VERSION = 1;
