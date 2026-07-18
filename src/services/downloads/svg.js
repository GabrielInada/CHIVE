/**
 * CHIVE SVG capture + download helpers. Used by chart export and panel
 * export to extract an `<svg>` from the DOM and trigger a file download
 * via a transient `<a>` element.
 *
 * @typedef {import('../../types.js').Result} Result
 */

import { ok, fail } from '../../utils/result.js';

/**
 * Slugify a user-supplied filename for safe download use: lowercase,
 * spaces → hyphens, strips characters outside `[a-z0-9._-]`, collapses
 * runs of hyphens, and trims leading/trailing dots/hyphens. Falls back
 * to `'chart'` when the input would resolve to empty.
 *
 * @private
 * @param {string | null | undefined} value
 * @returns {string}
 */
function sanitizeFileName(value) {
	return String(value || 'chart')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9._-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '') || 'chart';
}

/**
 * Set the SVG attributes a captured `<svg>` element needs before being
 * serialized to a standalone file: the `xmlns`/`xmlns:xlink` namespaces
 * and a derived `viewBox` when one is not already present.
 *
 * @param {SVGElement} svg - The SVG element to patch in place.
 */
export function ensureSvgAttributes(svg) {
	if (!svg.getAttribute('xmlns')) {
		svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	}
	if (!svg.getAttribute('xmlns:xlink')) {
		svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
	}

	const width = svg.getAttribute('width');
	const height = svg.getAttribute('height');
	if (!svg.getAttribute('viewBox') && width && height) {
		svg.setAttribute('viewBox', `0 0 ${Number(width)} ${Number(height)}`);
	}
}

/**
 * Capture the first `<svg>` inside the container as a serialized markup
 * string. Clones the SVG before patching so the live DOM is untouched.
 *
 * @param {string} containerId
 * @returns {Result} On success: `{ ok: true, svgMarkup: string }`. On failure: `{ ok: false, reason: 'container-not-found' | 'svg-not-found' }`.
 */
export function captureSvgMarkupFromContainer(containerId) {
	const container = document.getElementById(containerId);
	if (!container) return fail('container-not-found');

	const sourceSvg = container.querySelector('svg');
	if (!sourceSvg) return fail('svg-not-found');

	const svg = sourceSvg.cloneNode(true);
	ensureSvgAttributes(svg);
	const serializer = new XMLSerializer();
	return ok({ svgMarkup: serializer.serializeToString(svg) });
}

/**
 * Trigger a browser download of `svgMarkup` as `<sanitized>.svg`. The
 * download uses a transient anchor + object URL pair; both are cleaned up
 * synchronously after the click.
 *
 * @param {string} svgMarkup
 * @param {string} fileNameBase - Pre-sanitized base name (extension is appended).
 * @returns {Result} `{ ok: true }` on success; `{ ok: false, reason: 'empty-markup' }` when `svgMarkup` is falsy.
 */
export function downloadSvgMarkup(svgMarkup, fileNameBase) {
	if (!svgMarkup) return fail('empty-markup');
	const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = `${sanitizeFileName(fileNameBase)}.svg`;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
	return ok();
}

/**
 * One-shot capture + download. Composes
 * {@link captureSvgMarkupFromContainer} with {@link downloadSvgMarkup}.
 *
 * @param {string} containerId
 * @param {string} fileNameBase
 * @returns {Result} The first failing step's `Result`, or `{ ok: true }` when both succeed.
 */
export function downloadSvgFromContainer(containerId, fileNameBase) {
	const capturado = captureSvgMarkupFromContainer(containerId);
	if (!capturado.ok) return capturado;
	return downloadSvgMarkup(capturado.svgMarkup, fileNameBase);
}
