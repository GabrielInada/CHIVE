import process from 'node:process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	CELL_FORMAT_VERSION,
	MISSING_KEY,
	MISSING_TOKEN,
	canonicalizeRows,
	categoryKey,
	describeCategory,
	toCanonicalCell,
} from '../../../src/domain/datasets/cellValues.js';

const CURRENT = { formatVersion: CELL_FORMAT_VERSION };
const DATE_COLUMN = { name: 'd', type: 'date' };
const COLUMNS = [
	{ name: 'n', type: 'number', decimalSeparator: '.' },
	{ name: 'c', type: 'number', decimalSeparator: ',' },
	{ name: 't', type: 'text' },
	DATE_COLUMN,
];

// Zones on both sides of UTC, with their offset in January as
// getTimezoneOffset reports it.
const ZONES = [
	['America/Sao_Paulo', 180],
	['UTC', 0],
	['Asia/Tokyo', -540],
	['Pacific/Auckland', -780],
];

function useTimeZone(zone) {
	let previous;
	beforeAll(() => {
		previous = process.env.TZ;
		process.env.TZ = zone;
	});
	afterAll(() => {
		if (previous === undefined) delete process.env.TZ;
		else process.env.TZ = previous;
	});
}

const DATE_CASES = [
	[null, null],
	['', null],
	['   ', null],
	['not a date', null],
	// Day-first input is not inferred.
	['15/01/2024', null],
	['2024-01-15', '2024-01-15'],
	[' 2024-01-15 ', '2024-01-15'],
	['2024', '2024-01-01'],
	['2024-03', '2024-03-01'],
	['0099-12-31', '0099-12-31'],
	['+010000-01-01', '+010000-01-01'],
	['-000001-06-15T12:00:00Z', '-000001-06-15T12:00:00.000Z'],
	['9999-12-31T23:59:59.999Z', '9999-12-31T23:59:59.999Z'],
	['2024-01-15T10:30', '2024-01-15T10:30:00.000Z'],
	['2024-01-15 10:30:15', '2024-01-15T10:30:15.000Z'],
	['2024-01-15T10:30:15.123456', '2024-01-15T10:30:15.123Z'],
	// Midnight did not exist in Sao Paulo that day; the wall-clock reading survives.
	['2018-11-04T00:30', '2018-11-04T00:30:00.000Z'],
	['2024-01-15T10:30:00Z', '2024-01-15T10:30:00.000Z'],
	['2024-01-15T10:30:00-03:00', '2024-01-15T13:30:00.000Z'],
	['2024-01-15T10:30:00+0530', '2024-01-15T05:00:00.000Z'],
	['01/15/2024', '2024-01-15'],
	['Jan 15, 2024', '2024-01-15'],
	['2024/01/15 10:30', '2024-01-15T10:30:00.000Z'],
	['Jan 15, 2024 10:30 PM', '2024-01-15T22:30:00.000Z'],
	['01/15/2024 10:30 GMT', '2024-01-15T10:30:00.000Z'],
	['01/15/2024 UTC', '2024-01-15'],
	['01/15/2024 GMT+0900', '2024-01-15'],
	['Jan 15 2024 EST', '2024-01-15'],
	['Mon Jan 15 2024 10:30:00 GMT-0300 (Brasilia Standard Time)', '2024-01-15T13:30:00.000Z'],
	[new Date('2024-01-15T10:30:00Z'), '2024-01-15T10:30:00.000Z'],
	[new Date(NaN), null],
];

// Instants saved before canonical cells, with the dates they recover to.
const SAVED_DATE_CASES = [
	['UTC midnights', ['2024-01-15T00:00:00.000Z', '2024-07-15T00:00:00.000Z'], ['2024-01-15', '2024-07-15']],
	['UTC-3 midnights', ['2024-01-15T03:00:00.000Z', '2024-07-15T03:00:00.000Z'], ['2024-01-15', '2024-07-15']],
	[
		'UTC-2 and UTC-3 midnights across Brazilian DST',
		['2018-01-15T02:00:00.000Z', '2018-07-15T03:00:00.000Z'],
		['2018-01-15', '2018-07-15'],
	],
	['UTC-10 midnights', ['2024-01-15T10:00:00.000Z'], ['2024-01-15']],
	['UTC+9 midnights', ['2024-01-14T15:00:00.000Z', '2024-07-14T15:00:00.000Z'], ['2024-01-15', '2024-07-15']],
	[
		'UTC+1 and UTC+2 midnights across European DST',
		['2024-01-14T23:00:00.000Z', '2024-07-14T22:00:00.000Z'],
		['2024-01-15', '2024-07-15'],
	],
	[
		'UTC+0 and UTC+1 midnights across British DST',
		['2024-01-15T00:00:00.000Z', '2024-07-14T23:00:00.000Z'],
		['2024-01-15', '2024-07-15'],
	],
	[
		'UTC+13 and UTC+12 midnights across New Zealand DST',
		['2024-01-14T11:00:00.000Z', '2024-07-14T12:00:00.000Z'],
		['2024-01-15', '2024-07-15'],
	],
	[
		'times more than an hour apart',
		['2024-01-15T13:30:00.000Z', '2024-01-16T09:15:00.000Z'],
		['2024-01-15T13:30:00.000Z', '2024-01-16T09:15:00.000Z'],
	],
];

describe('toCanonicalCell', () => {
	describe('number columns', () => {
		it.each([
			[null, null],
			[undefined, null],
			['', null],
			['   ', null],
			['abc', null],
			['NaN', null],
			['Infinity', null],
			['12', 12],
			[' 12 ', 12],
			['-3.5', -3.5],
			['1,234.5', 1234.5],
			['1e3', 1000],
			[1.125, 1.125],
			[NaN, null],
			[Infinity, null],
		])('reads %o as %o', (raw, expected) => {
			expect(toCanonicalCell(raw, 'number')).toBe(expected);
		});

		it.each([
			['3,14', 3.14],
			['1.234,5', 1234.5],
			['1.000', 1000],
			// A typed number is never re-read with the column's string format.
			[1.125, 1.125],
		])('reads %o with a comma separator as %o', (raw, expected) => {
			expect(toCanonicalCell(raw, 'number', { decimalSeparator: ',' })).toBe(expected);
		});
	});

	describe('text columns', () => {
		it.each([
			[null, null],
			['', null],
			['   ', null],
			[' a ', 'a'],
			['N/A', 'N/A'],
			[0, '0'],
			[1.5, '1.5'],
			[false, 'false'],
			[{ a: 1 }, '{"a":1}'],
			[[1, 2], '[1,2]'],
		])('reads %o as %o', (raw, expected) => {
			expect(toCanonicalCell(raw, 'text')).toBe(expected);
		});
	});
});

describe('canonicalizeRows', () => {
	it('returns the same array when every cell is canonical', () => {
		const rows = [
			{ n: 1.5, c: 2, t: 'a', d: '2024-01-15' },
			{ n: null, c: null, t: null, d: '2024-01-15T10:30:00.000Z' },
		];
		expect(canonicalizeRows(rows, COLUMNS, CURRENT)).toBe(rows);
	});

	it('copies only the rows it changes and never mutates its input', () => {
		const canonical = Object.freeze({ n: 1, c: null, t: 'a', d: null });
		const blank = Object.freeze({ n: '', c: null, t: 'b', d: null });
		const rows = Object.freeze([canonical, blank]);

		const result = canonicalizeRows(rows, COLUMNS, CURRENT);

		expect(result).not.toBe(rows);
		expect(result[0]).toBe(canonical);
		expect(result[1]).toEqual({ n: null, c: null, t: 'b', d: null });
		expect(blank.n).toBe('');
	});

	it.each([
		['a blank number', { n: '' }, 'n', null],
		['a NaN number', { n: NaN }, 'n', null],
		['a whitespace number', { n: '  ' }, 'n', null],
		['a comma-decimal string', { c: '3,5' }, 'c', 3.5],
		['an absent column', {}, 'n', null],
		['blank text', { t: '' }, 't', null],
		['whitespace text', { t: '   ' }, 't', null],
		['padded text, read verbatim', { t: '  kept ' }, 't', '  kept '],
		['a number in a text column', { t: 7 }, 't', '7'],
		['a blank date', { d: '' }, 'd', null],
	])('canonicalizes %s', (_, row, name, expected) => {
		const [result] = canonicalizeRows([row], COLUMNS);
		expect(result[name]).toBe(expected);
	});

	it('recovers Date objects from old IndexedDB projects', () => {
		const rows = [{ d: new Date('2024-01-15T03:00:00.000Z') }, { d: new Date('2024-07-15T03:00:00.000Z') }];
		expect(canonicalizeRows(rows, [DATE_COLUMN]).map(row => row.d)).toEqual(['2024-01-15', '2024-07-15']);
	});

	it('keeps blanks missing and parses source strings beside recovered dates', () => {
		const rows = [{ d: '2024-01-15T03:00:00.000Z' }, { d: '' }, { d: null }, {}, { d: '2024-02-01' }];
		expect(canonicalizeRows(rows, [DATE_COLUMN]).map(row => row.d))
			.toEqual(['2024-01-15', null, null, null, '2024-02-01']);
	});

	it('reads date-times as midnights only in projects saved before canonical cells', () => {
		const rows = [{ d: '2024-01-15T15:00:00.000Z' }, { d: '2024-07-15T15:00:00.000Z' }];
		expect(canonicalizeRows(rows, [DATE_COLUMN], CURRENT)).toBe(rows);
		// Saved by the old format, the same text is a column of UTC+9 midnights.
		expect(canonicalizeRows(rows, [DATE_COLUMN]).map(row => row.d)).toEqual(['2024-01-16', '2024-07-16']);
	});
});

describe.each(ZONES)('dates in %s', (zone, januaryOffset) => {
	useTimeZone(zone);

	it('runs in that zone', () => {
		expect(new Date(2024, 0, 15).getTimezoneOffset()).toBe(januaryOffset);
	});

	it.each(DATE_CASES)('toCanonicalCell reads %o as %o', (raw, expected) => {
		expect(toCanonicalCell(raw, 'date')).toBe(expected);
	});

	it.each(SAVED_DATE_CASES)('canonicalizeRows recovers saved %s', (_, saved, expected) => {
		const rows = saved.map(d => ({ d }));
		expect(canonicalizeRows(rows, [DATE_COLUMN]).map(row => row.d)).toEqual(expected);
	});
});

describe('categories', () => {
	it.each([
		[null, MISSING_KEY],
		[undefined, MISSING_KEY],
		['N/A', 'N/A'],
		[1.5, '1.5'],
		['2024-01-15', '2024-01-15'],
	])('keys %o as %o', (value, key) => {
		expect(categoryKey(value)).toBe(key);
	});

	it('labels the missing bucket and keeps a real "N/A" apart from it', () => {
		const options = { missingLabel: '(ausente)' };
		expect(describeCategory(categoryKey(null), options)).toEqual({ label: '(ausente)', token: MISSING_TOKEN });
		expect(describeCategory(categoryKey('N/A'), options)).toEqual({ label: 'N/A', token: 'v:N/A' });
	});

	it('keeps the missing token that saved filters store', () => {
		expect(MISSING_TOKEN).toBe('__chive_missing__');
	});
});
