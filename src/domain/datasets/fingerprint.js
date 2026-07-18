/**
 * Deterministic dataset fingerprinting for persistence/export re-linking.
 *
 * The hash is data-identity only: it follows the stored column order and reads
 * each row by column name, so object key insertion order never affects the
 * fingerprint.
 */

const SHA256_ALGORITHM = 'sha256-canonical-v1';
const FNV1A_ALGORITHM = 'fnv1a-canonical-v1';
const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const FNV_64_MASK = 0xffffffffffffffffn;

function normalizeColumn(column) {
	return {
		name: typeof column?.name === 'string' ? column.name : '',
		type: typeof column?.type === 'string' ? column.type : '',
	};
}

function normalizeCellValue(value) {
	if (value === undefined) return { __chiveType: 'undefined' };
	if (typeof value === 'number' && !Number.isFinite(value)) {
		return { __chiveType: 'non-finite-number', value: String(value) };
	}
	return value;
}

/**
 * Build the canonical text input for dataset fingerprints.
 *
 * @param {import('../../types.js').Dataset | Object} dataset
 * @returns {string}
 */
export function canonicalizeDataset(dataset) {
	const columns = Array.isArray(dataset?.columns)
		? dataset.columns.map(normalizeColumn)
		: [];
	const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
	const canonicalRows = rows.map(row => (
		columns.map(column => normalizeCellValue(row?.[column.name]))
	));
	return JSON.stringify({ columns, rows: canonicalRows });
}

function bytesToHex(bytes) {
	return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function fnv1a64Hex(text) {
	const bytes = new TextEncoder().encode(text);
	let hash = FNV_OFFSET_BASIS_64;
	for (const byte of bytes) {
		hash ^= BigInt(byte);
		hash = (hash * FNV_PRIME_64) & FNV_64_MASK;
	}
	return hash.toString(16).padStart(16, '0');
}

async function sha256Hex(text, subtleCrypto) {
	const bytes = new TextEncoder().encode(text);
	const digest = await subtleCrypto.digest('SHA-256', bytes);
	return bytesToHex(new Uint8Array(digest));
}

/**
 * Compute a tagged deterministic fingerprint for a dataset.
 *
 * @param {import('../../types.js').Dataset | Object} dataset
 * @param {{ subtleCrypto?: SubtleCrypto | null }} [options]
 * @returns {Promise<{ fingerprint: string, algorithm: string }>}
 */
export async function computeDatasetFingerprint(dataset, { subtleCrypto = globalThis.crypto?.subtle } = {}) {
	const canonical = canonicalizeDataset(dataset);
	if (subtleCrypto && typeof subtleCrypto.digest === 'function') {
		try {
			return {
				fingerprint: await sha256Hex(canonical, subtleCrypto),
				algorithm: SHA256_ALGORITHM,
			};
		} catch {
			// Fall through to the deterministic sync fallback.
		}
	}
	return {
		fingerprint: fnv1a64Hex(canonical),
		algorithm: FNV1A_ALGORITHM,
	};
}

export const DATASET_FINGERPRINT_ALGORITHMS = Object.freeze({
	SHA256: SHA256_ALGORITHM,
	FNV1A_64: FNV1A_ALGORITHM,
});
