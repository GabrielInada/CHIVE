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
 */

const PRESET_FETCH_TIMEOUT_MS = 10000;

/**
 * Thrown by {@link loadPresetSource} when the 10s fetch timeout fires
 * before the response resolves. Distinguishable from a user-initiated
 * abort, which throws the caller's `signal.reason` (typically `DOMException`).
 */
export class PresetFetchTimeoutError extends Error {
	constructor() {
		super('preset-fetch-timeout');
		this.name = 'PresetFetchTimeoutError';
	}
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
 * @returns {Promise<PresetSource>}
 * @throws {PresetFetchTimeoutError} The fetch did not complete within `timeoutMs`.
 * @throws {Error} `'preset-data-missing'`, preset has neither `data` nor a usable `dataUrl`.
 * @throws {Error} `'preset-fetch-failed:<status>'`, server returned a non-2xx response.
 */
export async function loadPresetSource(preset, { signal, timeoutMs = PRESET_FETCH_TIMEOUT_MS } = {}) {
	if (Array.isArray(preset?.data)) {
		return { mode: 'inline', rows: preset.data, dropColumns: preset.dropColumns || [] };
	}

	if (typeof preset?.dataUrl !== 'string' || !preset.dataUrl.trim()) {
		throw new Error('preset-data-missing');
	}

	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	const combinedSignal = signal
		? AbortSignal.any([signal, timeoutSignal])
		: timeoutSignal;

	let response;
	try {
		response = await fetch(preset.dataUrl, { signal: combinedSignal });
	} catch (err) {
		if (timeoutSignal.aborted) throw new PresetFetchTimeoutError();
		throw err;
	}

	if (!response.ok) {
		throw new Error(`preset-fetch-failed:${response.status}`);
	}

	let rawText;
	try {
		rawText = await response.text();
	} catch (err) {
		if (timeoutSignal.aborted) throw new PresetFetchTimeoutError();
		throw err;
	}

	const format = String(preset.dataFormat || '').toLowerCase();
	const kind = format === 'json' || preset.dataUrl.toLowerCase().endsWith('.json') ? 'json' : 'csv';
	return { mode: 'fetched', kind, text: rawText, dropColumns: preset.dropColumns || [] };
}
