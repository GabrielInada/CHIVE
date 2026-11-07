import { describe, expect, it } from 'vitest';
import en from '../../../src/i18n/en.json';
import {
	measureLabelKey,
	measureOptionLabelKey,
	measureUsesValueColumn,
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
	});
});
