import { describe, expect, it } from 'vitest';
import { ingestDataset } from '../../../src/domain/datasets/ingest.js';

function ingest(values) {
	const result = ingestDataset({ kind: 'json', text: JSON.stringify(values.map(amount => ({ amount }))) });
	expect(result.ok).toBe(true);
	return result.value;
}

describe('currency ingestion', () => {
	it('keeps Brazilian reais numeric with their currency and cents', () => {
		const value = ingest(['R$ 1.234,56', 'R$\u00a025,50', '(R$ 10,00)', '', null]);
		expect(value.columns).toEqual([{ name: 'amount', type: 'number', currency: 'BRL', decimalSeparator: ',' }]);
		expect(value.rows.map(row => row.amount)).toEqual([1234.56, 25.5, -10, null, null]);
	});

	it('reads each currency column in its source number format', () => {
		const { value } = ingestDataset({ kind: 'csv', text: 'reais;dollars\nR$ 1.234,56;USD 1,234.56\nR$ 20,00;USD 20.00' });
		expect(value.columns.map(({ currency, decimalSeparator }) => [currency, decimalSeparator])).toEqual([['BRL', ','], ['USD', '.']]);
		expect(value.rows[0]).toEqual({ reais: 1234.56, dollars: 1234.56 });
	});

	it.each([
		['$ 10.00', '$ 20.00'],
		['BRL 10,00', 'USD 20,00'],
		[...Array(25).fill('R$ 10,00'), 'USD 20,00'],
		['R$ 1.2.3,45', 'R$ 20,00'],
	])('preserves unresolved or malformed currency amounts as text: %j', (...values) => {
		const value = ingest(values);
		expect(value.columns[0].type).toBe('text');
		expect(value.columns[0].currency).toBeUndefined();
		expect(value.rows.map(row => row.amount)).toEqual(values);
	});

	it('does not let the numeric detection threshold swallow currency conflicts', () => {
		const value = ingest([...Array(25).fill(10), 'R$ 20,00', 'USD 30.00']);
		expect(value.columns[0].type).toBe('text');
	});

	it('retains currency on joined numeric columns', () => {
		const result = ingestDataset({ kind: 'join', join: {
			leftRows: [{ id: 'a', amount: 1234.56 }], rightRows: [{ id: 'a', label: 'A' }],
			leftKeys: ['id'], rightKeys: ['id'],
			leftColumns: ['id', 'amount'], rightColumns: ['label'],
			leftColumnSpecs: [{ name: 'id', type: 'text' }, { name: 'amount', type: 'number', currency: 'BRL', decimalSeparator: ',' }],
		} });
		expect(result.ok).toBe(true);
		expect(result.value.columns.find(column => column.name === 'amount')).toMatchObject({ type: 'number', currency: 'BRL' });
		expect(result.value.rows[0].amount).toBe(1234.56);
	});

	it.each([
		[{}, { type: 'text', currencyIssue: 'ambiguous' }, 'R$ 1.000'],
		[{ decimalSeparator: ',' }, { type: 'number', currency: 'BRL' }, 1000],
	])('only resolves an ambiguous joined currency with an explicit source format: %j', (options, column, amount) => {
		const source = ingestDataset({ kind: 'json', text: JSON.stringify([{ id: 'a', amount: 'R$ 1.000' }]) }).value;
		expect(source.columns.find(item => item.name === 'amount')).toMatchObject({ type: 'text', currencyIssue: 'ambiguous' });
		const result = ingestDataset({ kind: 'join', options, join: {
			leftRows: source.rows, rightRows: [{ id: 'a', label: 'A' }],
			leftKeys: ['id'], rightKeys: ['id'],
			leftColumns: ['id', 'amount'], rightColumns: ['label'],
			leftColumnSpecs: source.columns,
		} });
		expect(result.ok).toBe(true);
		expect(result.value.columns.find(item => item.name === 'amount')).toMatchObject(column);
		expect(result.value.rows[0].amount).toBe(amount);
	});
});
