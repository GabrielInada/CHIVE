/**
 * Configuration for cached dataset statistics.
 */

/**
 * Cache generation for precomputed numeric statistics.
 *
 * Stamped onto `dataset.precomputedStats.numericVersion` at ingest
 * (`domain/datasets/ingest.js`) and checked at the hydration boundary. A
 * stored blob whose version is absent or lower is dropped and recomputed,
 * because its numbers were produced by an older, incorrect implementation.
 *
 * Bump this whenever `calculateNumericStatistics` changes which values it counts or
 * how it aggregates them. Categorical stats carry their own
 * {@link STATS_CATEGORICAL_VERSION}, so they survive a numeric-only bump.
 *
 * 1: initial. Blank cells in a numeric column were counted, so `min` could
 *    return an empty string and `mean`/`median`/`n` were skewed toward zero.
 */
export const STATS_NUMERIC_VERSION = 1;

/**
 * Cache generation for precomputed categorical statistics.
 *
 * Stamped onto `dataset.precomputedStats.categoricalVersion` at ingest and
 * checked at the hydration boundary like {@link STATS_NUMERIC_VERSION}.
 *
 * Bump this whenever `calculateCategoricalStatistics` changes which values it
 * counts, how it keys them, or the shape of its cached results.
 *
 * 1: initial. Older blobs were computed before cells were canonical: a date
 *    column's categories were keyed by the text of a local-time `Date`, which
 *    its canonical cells no longer match.
 * 2: fraction fields use `missingFraction`, `modeFraction`, and `top5Fraction`
 *    instead of the misleading `Pct` suffix. Version 1 caches are discarded
 *    at hydration and recomputed from rows; numeric caches remain valid.
 */
export const STATS_CATEGORICAL_VERSION = 2;
