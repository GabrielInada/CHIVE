/**
 * Configuration for column type detection.
 */

export const TYPE_DETECTION = {
  sampleSize: 20,
  numberThreshold: 0.8,  // 80% of values must be numeric
  dateThreshold: 0.8,    // 80% of values must be parseable as dates
};

export const COLUMN_TYPES = {
  NUMBER: 'numero',
  TEXT: 'texto',
  DATE: 'data',
};

export const TYPE_DEFAULTS = {
  fallback: COLUMN_TYPES.TEXT,
};

export const DECIMAL_DETECTION = {
  // Number of raw values sampled across all columns for separator detection.
  // Larger than TYPE_DETECTION.sampleSize for better signal coverage.
  sampleSize: 60,

  // If more than this fraction of numeric-looking values produce NaN
  // with the detected separator, the fallback validator tries the other separator.
  nanRateThreshold: 0.5,
};
