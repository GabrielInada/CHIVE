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
