/**
 * Browser download helper for binary artifacts.
 *
 * @typedef {import('../../types.js').Result} Result
 */

import { ok, fail } from '../../utils/result.js';

export function sanitizeDownloadFileName(value, fallback = 'download') {
	const safeFallback = String(fallback || 'download');
	return String(value || safeFallback)
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9._-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '') || safeFallback;
}

function normalizeBytes(bytes) {
	if (ArrayBuffer.isView(bytes)) {
		return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	}
	if (Object.prototype.toString.call(bytes) === '[object ArrayBuffer]') {
		return new Uint8Array(bytes);
	}
	return null;
}

/**
 * Trigger a browser download for a Uint8Array/ArrayBuffer payload.
 *
 * @param {Uint8Array | ArrayBuffer} bytes
 * @param {string} fileName
 * @param {{ mimeType?: string }} [options]
 * @returns {Result}
 */
export function downloadBytes(bytes, fileName, { mimeType = 'application/octet-stream' } = {}) {
	const normalized = normalizeBytes(bytes);
	if (!normalized || normalized.byteLength === 0) return fail('empty-bytes');

	const blob = new Blob([normalized], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = sanitizeDownloadFileName(fileName, 'download');
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
	return ok();
}
