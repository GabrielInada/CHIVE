import { describe, expect, it } from 'vitest';
import en from '../../../src/i18n/en.json';
import {
	measureLabelKey,
	measureOptionLabelKey,
	measureUsesValueColumn,
	valueColumnForMeasure,
} from '../../../src/charts/shared/measure.js';

describe('measure', () => {
	it.each([
		['count', 'Count', 'Count rows', false],
		['sum', 'Sum', 'Sum numeric column', true],
		['mean', 'Mean', 'Average numeric column', true],
	])('names the %s measure and says whether it reads a value column', (measure, label, optionLabel, usesValueColumn) => {
		expect(en[measureLabelKey(measure)]).toBe(label);
		expect(en[measureOptionLabelKey(measure)]).toBe(optionLabel);
		expect(measureUsesValueColumn(measure)).toBe(usesValueColumn);
	});

	it.each([undefined, null, '', 'median', 'constructor'])('treats %j as count, as category aggregation does', measure => {
		expect(measureLabelKey(measure)).toBe(measureLabelKey('count'));
		expect(measureOptionLabelKey(measure)).toBe(measureOptionLabelKey('count'));
		expect(measureUsesValueColumn(measure)).toBe(false);
		expect(valueColumnForMeasure(measure, 'hidden', ['sales'])).toBe('hidden');
	});
});

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
});
