/**
 * Canonical raw-static runtime file set.
 *
 * Deployment consumers and public deployment guidance are parity-tested
 * against this manifest. Directory entries intentionally omit trailing
 * slashes so each consumer can apply its own syntax.
 */
export const RUNTIME_FILE_SET = Object.freeze([
	'index.html',
	'about.html',
	'src',
	'vendor',
]);
