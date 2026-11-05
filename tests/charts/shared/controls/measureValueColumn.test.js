import { describe, expect, it } from 'vitest';
import { valueColumnForMeasure } from '../../../../src/charts/shared/controls/measureValueColumn.js';

describe('valueColumnForMeasure', () => {
	const numeric = ['sales', 'profit'];

	it('keeps the value column for count, numeric or not', () => {
		expect(valueColumnForMeasure('count', 'profit', numeric)).toBe('profit');
		expect(valueColumnForMeasure('count', 'hidden', numeric)).toBe('hidden');
		expect(valueColumnForMeasure('count', null, numeric)).toBeNull();
	});

	it.each(['sum', 'mean'])('keeps a numeric value column for %s', measureMode => {
		expect(valueColumnForMeasure(measureMode, 'profit', numeric)).toBe('profit');
	});

	it.each(['sum', 'mean'])('takes the first numeric column for %s without a numeric value column', measureMode => {
		expect(valueColumnForMeasure(measureMode, null, numeric)).toBe('sales');
		expect(valueColumnForMeasure(measureMode, 'hidden', numeric)).toBe('sales');
	});

	it('returns null for sum when no column is numeric', () => {
		expect(valueColumnForMeasure('sum', 'hidden', [])).toBeNull();
	});

	it('treats a measure no chart offers as count', () => {
		expect(valueColumnForMeasure('median', 'hidden', numeric)).toBe('hidden');
	});
});
