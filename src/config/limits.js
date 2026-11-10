/**
 * Confirmation thresholds for large inputs and bounds for preview row counts.
 * Users may approve inputs above the warning thresholds.
 */

export const LARGE_FILE_WARNING_BYTES = 15 * 1024 * 1024; // 15 MiB
export const LARGE_DATASET_WARNING_ROWS = 200000;

export const PREVIEW_DEFAULT_ROWS = 10;
export const PREVIEW_MAX_ROWS = 1000;
export const PREVIEW_MIN_ROWS = 1;
