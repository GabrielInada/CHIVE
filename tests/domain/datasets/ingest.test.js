import { describe, expect, it } from 'vitest';
import { ingestDataset } from '../../../src/domain/datasets/ingest.js';
import { STATS_CATEGORICAL_VERSION, STATS_NUMERIC_VERSION } from '../../../src/config/statistics.js';

function ingest(request) {
	const result = ingestDataset(request);
	expect(result.ok, result.reason).toBe(true);
	return result.value;
}

function ingestWithProgress(request) {
	const progress = [];
	const result = ingestDataset(request, { onProgress: tick => progress.push(tick) });
	return { result, progress };
}

describe('ingestDataset', () => {
	it('returns canonical rows, typed columns, and stats stamped with both versions', () => {
		expect(ingestDataset({ kind: 'csv', text: 'a,b\n1,2\n3,4\n' })).toEqual({
			ok: true,
			value: {
				rows: [
					{ a: 1, b: 2 },
					{ a: 3, b: 4 },
				],
				columns: [
					{ name: 'a', type: 'number', decimalSeparator: '.' },
					{ name: 'b', type: 'number', decimalSeparator: '.' },
				],
				precomputedStats: {
					numeric: [
						{ name: 'a', n: 2, min: 1, max: 3, mean: 2, median: 2 },
						{ name: 'b', n: 2, min: 2, max: 4, mean: 3, median: 3 },
					],
					categorical: [],
					numericVersion: STATS_NUMERIC_VERSION,
					categoricalVersion: STATS_CATEGORICAL_VERSION,
				},
				truncatedFrom: null,
			},
		});
	});

	it.each([
		{
			kind: 'csv',
			text: 'name,amount,day\n Ana ,1.5,2024-01-15\n,  ,\nBia,2,2024-02-01 10:30\n',
			expected: [
				{ name: 'Ana', amount: 1.5, day: '2024-01-15' },
				{ name: null, amount: null, day: null },
				{ name: 'Bia', amount: 2, day: '2024-02-01T10:30:00.000Z' },
			],
		},
		{
			kind: 'json',
			text: '[{"name":"Ana","tags":{"a":1},"amount":1.5},{"name":"  ","tags":"x"}]',
			expected: [
				{ name: 'Ana', tags: '{"a":1}', amount: 1.5 },
				{ name: null, tags: 'x', amount: null },
			],
		},
	])('returns canonical $kind rows', ({ kind, text, expected }) => {
		expect(ingest({ kind, text }).rows).toStrictEqual(expected);
	});

	it('ingests a semicolon CSV with comma decimals and partial rows end to end', () => {
		// The shape that first surfaced the phantom-zero bug: a survey export
		// where some rows carry only a point label. Exercises delimiter
		// detection, decimal-comma normalization, and stats in one pass.
		const csv = [
			'Ponto;Codigo;X;Y;Z',
			'E1;PQT;784431,551;9839149,107;6,358',
			'E0;PQT;784411,896;9839159,365;7,045',
			'A17;ARV;784496,014;9839134,221;6,077',
			'E2;;;;',
			'E1;;;;',
		].join('\n') + '\n';

		const value = ingest({ kind: 'csv', text: csv });

		const typeByName = Object.fromEntries(value.columns.map(c => [c.name, c.type]));
		expect(typeByName).toEqual({ Ponto: 'text', Codigo: 'text', X: 'number', Y: 'number', Z: 'number' });

		// Comma decimals became real numbers, not 1000x integers.
		expect(value.rows[0].X).toBeCloseTo(784431.551, 3);
		expect(value.rows[0].Z).toBeCloseTo(6.358, 3);

		// The partial rows survive as rows, but contribute nothing numeric.
		expect(value.rows).toHaveLength(5);
		const statsX = value.precomputedStats.numeric.find(s => s.name === 'X');
		expect(statsX.n).toBe(3);
		expect(statsX.min).toBeCloseTo(784411.896, 3);
		expect(statsX.max).toBeCloseTo(784496.014, 3);
		expect(typeof statsX.min).toBe('number');
	});

	it('keeps dot-decimal survey coordinates with 3 decimals exact', () => {
		// Same survey shape as above, exported with dot decimals. The small Z
		// values look like European thousands ("6.358") and used to cast the only
		// votes, so every coordinate was read 1000 times too large.
		const csv = [
			'Ponto,Codigo,X,Y,Z',
			'E1,PQT,784431.551,9839149.107,6.358',
			'E0,PQT,784411.896,9839159.365,7.045',
			'A17,ARV,784496.014,9839134.221,6.077',
		].join('\n') + '\n';

		const value = ingest({ kind: 'csv', text: csv });

		expect(value.columns.map(c => c.decimalSeparator)).toEqual(['.', '.', '.', '.', '.']);
		expect(value.rows[0].X).toBeCloseTo(784431.551, 3);
		expect(value.rows[0].Y).toBeCloseTo(9839149.107, 3);
		expect(value.rows[0].Z).toBeCloseTo(6.358, 3);
	});

	it.each([
		{
			name: 'three-decimal measurements without larger coordinates',
			kind: 'csv',
			text: 'v\n6.358\n7.045\n',
			separator: '.',
			expected: [6.358, 7.045],
		},
		{
			name: 'zero-padded thousands with explicit European decimals',
			kind: 'csv',
			text: 'id;v\n1;01.358\n2;1.234,56\n',
			separator: ',',
			expected: [1358, 1234.56],
		},
		{
			name: 'mixed typed numbers and dot-decimal strings',
			kind: 'json',
			text: '[{"v":2.5},{"v":"1.250"}]',
			separator: '.',
			expected: [2.5, 1.25],
		},
		{
			name: 'whole-number decimal strings alongside typed fractions',
			kind: 'json',
			text: '[{"v":2.5},{"v":"1.000"}]',
			separator: '.',
			expected: [2.5, 1],
		},
		{
			name: 'whole-number measurements without explicit decimal evidence',
			kind: 'csv',
			text: 'v\n6.000\n7.045\n',
			separator: '.',
			expected: [6, 7.045],
		},
		{
			name: 'European decimal strings alongside typed fractions',
			kind: 'json',
			text: '[{"v":2.5},{"v":3.75},{"v":"1.234,56"}]',
			separator: ',',
			expected: [2.5, 3.75, 1234.56],
		},
		{
			name: 'whole-number measurements with explicit dot-decimal evidence',
			kind: 'csv',
			text: 'v\n6.000\n7.045\n8.25\n',
			separator: '.',
			expected: [6, 7.045, 8.25],
		},
		{
			name: 'explicit thousands grouping alongside ambiguous values',
			kind: 'csv',
			text: 'v\n1.234.567\n01.358\n12.500\n',
			separator: ',',
			expected: [1234567, 1358, 12500],
		},
		{
			name: 'whole-number measurements in joined data',
			kind: 'join',
			join: {
				leftRows: [{ id: 1, v: '6.000' }, { id: 2, v: '7.045' }],
				rightRows: [{ id: 1 }, { id: 2 }],
				leftKeys: ['id'],
				rightKeys: ['id'],
				joinType: 'inner',
				leftColumns: ['id', 'v'],
				rightColumns: [],
			},
			separator: '.',
			expected: [6, 7.045],
		},
	])('preserves $name', ({ kind, text, join, separator, expected }) => {
		const value = ingest({ kind, text, join });
		expect(value.rows.map(row => row.v)).toEqual(expected);
		expect(value.columns.find(c => c.name === 'v')?.decimalSeparator).toBe(separator);
	});

	it.each([
		{
			name: 'comma decimals next to a text column',
			kind: 'json',
			text: JSON.stringify([{ valor: '3,14', name: 'pi' }, { valor: '2,71', name: 'e' }, { valor: '1,41', name: 'sqrt2' }]),
			column: 'valor',
			expected: [3.14, 2.71, 1.41],
		},
		{
			name: 'European grouping with comma decimals',
			kind: 'json',
			text: JSON.stringify([{ preco: '1.234,56' }, { preco: '2.000,75' }]),
			column: 'preco',
			expected: [1234.56, 2000.75],
		},
		{
			name: 'comma decimals in a semicolon CSV',
			kind: 'csv',
			text: 'id;valor\n1;3,14\n2;2,71\n3;1,41',
			column: 'valor',
			expected: [3.14, 2.71, 1.41],
		},
		{
			name: 'quoted US grouping with dot decimals',
			kind: 'csv',
			text: 'id,value\n1,"1,234.56"\n2,"2,345.67"\n3,"3,456.78"',
			column: 'value',
			expected: [1234.56, 2345.67, 3456.78],
		},
		{
			name: 'quoted US grouping without decimals',
			kind: 'csv',
			text: 'id,value\n1,"1,000"\n2,"2,000"\n3,"3,000"\n4,"4,000"\n5,"5,000"',
			column: 'value',
			expected: [1000, 2000, 3000, 4000, 5000],
		},
		{
			name: 'high-precision decimals',
			kind: 'json',
			text: JSON.stringify([{ value: '1234.56789' }, { value: '2345.67891' }, { value: '3456.78912' }]),
			column: 'value',
			expected: [1234.56789, 2345.67891, 3456.78912],
		},
		{
			name: 'scientific notation',
			kind: 'json',
			text: JSON.stringify([{ value: '1.23456e3' }, { value: '2.34567e3' }, { value: '3.45678e3' }]),
			column: 'value',
			expected: [1234.56, 2345.67, 3456.78],
		},
		{
			name: 'negative numbers',
			kind: 'json',
			text: JSON.stringify([{ value: '-1234.56' }, { value: '-2345.67' }, { value: '-3456.78' }]),
			column: 'value',
			expected: [-1234.56, -2345.67, -3456.78],
		},
		{
			name: 'decimals with a leading zero',
			kind: 'json',
			text: JSON.stringify([{ value: '0.56' }, { value: '0.78' }, { value: '0.91' }]),
			column: 'value',
			expected: [0.56, 0.78, 0.91],
		},
	])('reads $name as numbers', ({ kind, text, column, expected }) => {
		const value = ingest({ kind, text });
		expect(value.columns.find(c => c.name === column)?.type).toBe('number');
		expect(value.rows.map(row => row[column])).toEqual(expected);
	});

	it('keeps values that read as infinite as text instead of typing the column as numbers', () => {
		const value = ingest({ kind: 'csv', text: 'label,value\na,Infinity\nb,-Infinity\nc,1e999\n' });
		expect(value.columns.find(c => c.name === 'value')?.type).toBe('text');
		expect(value.rows.map(row => row.value)).toEqual(['Infinity', '-Infinity', '1e999']);
	});

	it('keeps typed JSON numbers with 3 decimals exact', () => {
		const value = ingest({ kind: 'json', text: '[{"v":1.125},{"v":2.25},{"v":3.375}]' });
		expect(value.rows).toEqual([{ v: 1.125 }, { v: 2.25 }, { v: 3.375 }]);
	});

	it('preserves ambiguous grouped CSV integers with an explicit comma separator', () => {
		const value = ingest({
			kind: 'csv', text: 'population\n1.000\n1.234\n2.345\n',
			options: { decimalSeparator: ',' },
		});
		expect(value.rows.map(row => row.population)).toEqual([1000, 1234, 2345]);
	});

	it.each([
		{ decimalSeparator: 'auto', population: 1 },
		{ decimalSeparator: '.', population: 1 },
		{ decimalSeparator: ',', population: 1000 },
	])('keeps typed JSON fractions independent of $decimalSeparator string formatting', ({ decimalSeparator, population }) => {
		const value = ingest({
			kind: 'json', text: '[{"rate":2.5,"population":"1.000"}]',
			options: { decimalSeparator },
		});
		expect(value.rows).toEqual([{ rate: 2.5, population }]);
	});

	it('preserves ambiguous grouped joined values with an explicit comma separator', () => {
		const value = ingest({
			kind: 'join',
			options: { decimalSeparator: ',' },
			join: {
				leftRows: [{ id: 1, rate: 2.5 }],
				rightRows: [{ id: 1, population: '1.000' }],
				leftKeys: ['id'],
				rightKeys: ['id'],
				joinType: 'inner',
				leftColumns: ['id', 'rate'],
				rightColumns: ['population'],
				leftDatasetName: 'rates.json',
				rightDatasetName: 'population.csv',
			},
		});
		expect(value.rows).toEqual([{ id: 1, rate: 2.5, population: 1000 }]);
	});

	it('keeps typed join rows with 3 decimals exact', () => {
		const value = ingest({
			kind: 'join',
			join: {
				leftRows: [
					{ id: 1, amount: 1.125 },
					{ id: 2, amount: 2.375 },
				],
				rightRows: [
					{ id: 1, target: 6.358 },
					{ id: 2, target: 7.045 },
				],
				leftKeys: ['id'],
				rightKeys: ['id'],
				joinType: 'inner',
				leftColumns: ['id', 'amount'],
				rightColumns: ['target'],
				leftDatasetName: 'left.csv',
				rightDatasetName: 'right.csv',
			},
		});
		expect(value.rows).toEqual([
			{ id: 1, amount: 1.125, target: 6.358 },
			{ id: 2, amount: 2.375, target: 7.045 },
		]);
	});

	describe('joined columns with saved decimal separators', () => {
		// Both sources hold the text "1.000", one read with comma decimals and
		// one with dot decimals. The join narrows each column to that one value.
		const join = {
			leftRows: [{ id: 'a', population: '1.000' }],
			rightRows: [{ id: 'a', population: '1.000' }],
			leftKeys: ['id'],
			rightKeys: ['id'],
			leftColumns: ['population'],
			rightColumns: ['population'],
			leftColumnSpecs: [{ name: 'population', type: 'text', decimalSeparator: ',' }],
			rightColumnSpecs: [{ name: 'population', type: 'text', decimalSeparator: '.' }],
			leftDatasetName: 'comma.csv',
			rightDatasetName: 'dot.csv',
		};

		it('reads each one with its source column separator, through conflict renaming', () => {
			const value = ingest({ kind: 'join', join });
			expect(value.columns).toEqual([
				{ name: 'comma.population', type: 'number', decimalSeparator: ',' },
				{ name: 'dot.population', type: 'number', decimalSeparator: '.' },
			]);
			expect(value.rows).toEqual([{ 'comma.population': 1000, 'dot.population': 1 }]);
		});

		it('reads every one with an explicit separator instead', () => {
			const value = ingest({ kind: 'join', join, options: { decimalSeparator: ',' } });
			expect(value.columns.map(c => c.decimalSeparator)).toEqual([',', ',']);
			expect(value.rows).toEqual([{ 'comma.population': 1000, 'dot.population': 1000 }]);
		});
	});

	it('caps rows at options.rowLimit and reports the original count', () => {
		const csv = 'a\n' + Array.from({ length: 100 }, (_, i) => i).join('\n') + '\n';
		const value = ingest({ kind: 'csv', text: csv, options: { rowLimit: 10 } });
		expect(value.rows).toHaveLength(10);
		expect(value.truncatedFrom).toBe(100);
	});

	it('drops columns named in options.dropColumns before type detection', () => {
		const value = ingest({ kind: 'csv', text: 'a,b,c\n1,2,3\n', options: { dropColumns: ['b'] } });
		expect(value.columns.map(c => c.name)).toEqual(['a', 'c']);
		expect(value.rows).toEqual([{ a: 1, c: 3 }]);
	});

	it('parses JSON arrays', () => {
		expect(ingest({ kind: 'json', text: '[{"a":1},{"a":2}]' }).rows).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it('joins and canonicalizes complete row sets', () => {
		const { result, progress } = ingestWithProgress({
			kind: 'join',
			join: {
				leftRows: [
					{ id: '1', amount: '10' },
					{ id: '2', amount: '20' },
				],
				rightRows: [
					{ id: '1', target: '99' },
					{ id: '2', target: '88' },
				],
				leftKeys: ['id'],
				rightKeys: ['id'],
				joinType: 'inner',
				leftColumns: ['id', 'amount'],
				rightColumns: ['target'],
				leftDatasetName: 'left.csv',
				rightDatasetName: 'right.csv',
			},
		});

		expect(progress[0]).toEqual({ stage: 'joining', percent: 0 });
		expect(result.value.rows).toEqual([
			{ id: 1, amount: 10, target: 99 },
			{ id: 2, amount: 20, target: 88 },
		]);
		expect(result.value.columns.map(c => c.name)).toEqual(['id', 'amount', 'target']);
		expect(result.value.truncatedFrom).toBeNull();
	});

	it('keeps the output columns as text when a join matches nothing', () => {
		const { result, progress } = ingestWithProgress({
			kind: 'join',
			join: {
				leftRows: [{ id: 1, v: '2' }],
				rightRows: [{ id: 9, w: 'a' }],
				leftKeys: ['id'],
				rightKeys: ['id'],
				joinType: 'inner',
				leftColumns: ['id', 'v'],
				rightColumns: ['w'],
				leftColumnSpecs: [{ name: 'v', type: 'number', decimalSeparator: ',' }],
			},
		});

		expect(result).toEqual({
			ok: true,
			value: {
				rows: [],
				columns: [
					{ name: 'id', type: 'text', decimalSeparator: '.' },
					{ name: 'v', type: 'text', decimalSeparator: ',' },
					{ name: 'w', type: 'text', decimalSeparator: '.' },
				],
				precomputedStats: {
					numeric: [],
					categorical: [],
					numericVersion: STATS_NUMERIC_VERSION,
					categoricalVersion: STATS_CATEGORICAL_VERSION,
				},
				truncatedFrom: null,
			},
		});
		expect(progress).toEqual([
			{ stage: 'joining', percent: 0 },
			{ stage: 'joining', percent: 30 },
		]);
	});

	it('reports every file stage in order, with percentages that never decrease and end at 100', () => {
		const csv = 'a,b\n' + Array.from({ length: 30 }, (_, i) => `${i},${i * 2}`).join('\n') + '\n';
		const { progress } = ingestWithProgress({ kind: 'csv', text: csv });

		expect([...new Set(progress.map(tick => tick.stage))])
			.toEqual(['parsing', 'decimal-detection', 'type-detection', 'normalize', 'stats']);
		const percents = progress.map(tick => tick.percent);
		for (let i = 1; i < percents.length; i++) {
			expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
		}
		expect(percents.at(-1)).toBe(100);
	});

	it('reports normalize progress after each 20,000-row chunk', () => {
		const csv = 'a\n' + Array.from({ length: 30000 }, (_, i) => i).join('\n') + '\n';
		const { result, progress } = ingestWithProgress({ kind: 'csv', text: csv });

		expect(result.value.rows).toHaveLength(30000);
		expect(progress.filter(tick => tick.stage === 'normalize').map(tick => tick.percent)).toEqual([77, 90]);
	});

	it('fails with the parser reason and reports nothing after the first tick', () => {
		const { result, progress } = ingestWithProgress({ kind: 'csv', text: '' });
		expect(result).toEqual({ ok: false, reason: 'csv-empty' });
		expect(progress).toEqual([{ stage: 'parsing', percent: 0 }]);
	});

	it('fails with the join reason', () => {
		const result = ingestDataset({
			kind: 'join',
			join: { leftRows: [], rightRows: [], leftKeys: [], rightKeys: [] },
		});
		expect(result).toEqual({ ok: false, reason: 'join-keys-required' });
	});
});
