/**
 * Configuration for supported file formats.
 */

export const SUPPORTED_FORMATS = ['csv', 'tsv', 'dsv', 'txt', 'json'];

// Extensions accepted for delimited text files (all treated as DSV with auto-detection)
export const DELIMITED_EXTENSIONS = ['csv', 'tsv', 'dsv', 'txt'];

export const ACCEPT_ATTRIBUTE = '.csv,.tsv,.dsv,.txt,.json,text/csv,text/tab-separated-values,application/json';

// Candidate delimiters tested during auto-detection, in priority order (used as tiebreaker)
export const DELIMITER_CANDIDATES = [',', ';', '\t', '|'];
