import { describe, expect, it } from 'vitest';
import {
	canonicalizeDataset,
	computeDatasetFingerprint,
	DATASET_FINGERPRINT_ALGORITHMS,
} from '../../src/utils/datasetFingerprint.js';

const dataset = {
	columns: [
		{ name: 'b', type: 'text' },
		{ name: 'a', type: 'number' },
	],
	rows: [
		{ a: 1, b: 'x' },
		{ b: 'y', a: 2 },
	],
};

describe('datasetFingerprint', () => {
	it('canonicalizes by stored column order and row values by column name', () => {
		const reorderedKeys = {
			columns: dataset.columns,
			rows: [
				{ b: 'x', a: 1 },
				{ a: 2, b: 'y' },
			],
		};
		expect(canonicalizeDataset(dataset)).toBe(canonicalizeDataset(reorderedKeys));
		expect(canonicalizeDataset(dataset)).toContain('"columns":[{"name":"b","type":"text"},{"name":"a","type":"number"}]');
	});

	it('uses SHA-256 when subtle crypto is available', async () => {
		const result = await computeDatasetFingerprint(dataset);
		expect(result.algorithm).toBe(DATASET_FINGERPRINT_ALGORITHMS.SHA256);
		expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
	});

	it('falls back to tagged FNV-1a when subtle crypto is unavailable', async () => {
		const one = await computeDatasetFingerprint(dataset, { subtleCrypto: null });
		const two = await computeDatasetFingerprint(dataset, { subtleCrypto: null });
		expect(one).toEqual(two);
		expect(one.algorithm).toBe(DATASET_FINGERPRINT_ALGORITHMS.FNV1A_64);
		expect(one.fingerprint).toMatch(/^[a-f0-9]{16}$/);
	});
});
