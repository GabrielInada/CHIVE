/**
 * CHIVE Preset Service.
 *
 * Resolves a preset descriptor to a usable data source. Inline presets return
 * their `data` array as-is; remote presets fetch `dataUrl` with a 10s timeout
 * and a caller-supplied AbortSignal so the user-cancel button can interrupt
 * the fetch (not just the downstream worker ingest).
 *
 * @typedef {import('../types.js').PresetDescriptor} PresetDescriptor
 * @typedef {import('../types.js').PresetSource} PresetSource
 * @typedef {import('../types.js').Result} Result
 */

import { ok, fail } from '../utils/result.js';

const PRESET_FETCH_TIMEOUT_MS = 10000;

/**
 * Classify a fetch/body-read failure into a stable reason. A user-initiated
 * abort wins over the timeout (so cancel reads as `'cancelled'`, matching the
 * worker-ingest path); the composed timeout reads as `'preset-fetch-timeout'`;
 * anything else (a genuine network error) is `'preset-fetch-network'`.
 *
 * @private
 */
function fetchFailureReason(signal, timeoutSignal) {
	if (signal?.aborted) return 'cancelled';
	if (timeoutSignal.aborted) return 'preset-fetch-timeout';
	return 'preset-fetch-network';
}

/**
 * Resolve a preset descriptor to a usable data source. Inline presets
 * (presets with a `data` array) short-circuit and return immediately;
 * remote presets fetch `dataUrl` with a 10s timeout composed with the
 * caller's optional abort signal.
 *
 * Format detection prefers `preset.dataFormat` (case-insensitive) and
 * falls back to checking whether the URL ends with `.json`. Everything
 * else is treated as CSV.
 *
 * @param {PresetDescriptor} preset
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<Result>} `ok({ value: PresetSource })` on success, or `fail(reason)` with one of:
 *   `'preset-data-missing'` (neither `data` nor a usable `dataUrl`), `'cancelled'` (caller aborted),
 *   `'preset-fetch-timeout'` (no response within `timeoutMs`), `'preset-fetch-failed:<status>'`
 *   (non-2xx response), or `'preset-fetch-network'` (the fetch/body read failed otherwise).
 */
export async function loadPresetSource(preset, { signal, timeoutMs = PRESET_FETCH_TIMEOUT_MS } = {}) {
	if (Array.isArray(preset?.data)) {
		return ok({ value: { mode: 'inline', rows: preset.data, dropColumns: preset.dropColumns || [] } });
	}

	if (typeof preset?.dataUrl !== 'string' || !preset.dataUrl.trim()) {
		return fail('preset-data-missing');
	}

	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	const combinedSignal = signal
		? AbortSignal.any([signal, timeoutSignal])
		: timeoutSignal;

	let response;
	try {
		response = await fetch(preset.dataUrl, { signal: combinedSignal });
	} catch {
		return fail(fetchFailureReason(signal, timeoutSignal));
	}

	if (!response.ok) {
		return fail(`preset-fetch-failed:${response.status}`);
	}

	let rawText;
	try {
		rawText = await response.text();
	} catch {
		return fail(fetchFailureReason(signal, timeoutSignal));
	}

	const format = String(preset.dataFormat || '').toLowerCase();
	const kind = format === 'json' || preset.dataUrl.toLowerCase().endsWith('.json') ? 'json' : 'csv';
	return ok({ value: { mode: 'fetched', kind, text: rawText, dropColumns: preset.dropColumns || [] } });
}
