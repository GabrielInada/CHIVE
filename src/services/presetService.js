/**
 * CHIVE Preset Service
 *
 * Resolves a preset descriptor to a usable data source. Inline presets return
 * their `data` array as-is; remote presets fetch `dataUrl` with a 10s timeout
 * and a caller-supplied AbortSignal so the user-cancel button can interrupt
 * the fetch (not just the downstream worker ingest).
 */

const PRESET_FETCH_TIMEOUT_MS = 10000;

export class PresetFetchTimeoutError extends Error {
	constructor() {
		super('preset-fetch-timeout');
		this.name = 'PresetFetchTimeoutError';
	}
}

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
