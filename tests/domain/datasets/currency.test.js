import { describe, expect, it } from 'vitest';
import { analyzeCurrencyColumn, parseCurrencyValue, prepareCurrencyChange } from '../../../src/domain/datasets/currency.js';

describe('currency column contract', () => {
	it('does not mistake words ending in a currency code for monetary values', () => {
		expect(analyzeCurrencyColumn(['cars', 'CAD', 'USD report', 'pen'])).toBeNull();
	});
	it.each([
		['R$ 1.234,56', 'BRL', ',', 1234.56],
		['-R$ 1,50', 'BRL', ',', -1.5],
		['R$ -1,50', 'BRL', ',', -1.5],
		['(BRL 1,50)', 'BRL', ',', -1.5],
		['1\u202f234,56 €', 'EUR', ',', 1234.56],
		['USD 1,234.56', 'USD', '.', 1234.56],
		['$1,234.56', 'CAD', '.', 1234.56],
		['JPY 1234', 'JPY', '.', 1234],
		[2.5, 'BRL', ',', 2.5],
		['', 'BRL', ',', null],
		[null, 'BRL', ',', null],
	])('reads %j as %s with decimal %s', (raw, currency, decimalSeparator, expected) => {
		expect(parseCurrencyValue(raw, { currency, decimalSeparator })).toBe(expected);
	});

	it.each(['R$ 1.2.3,45', 'R$ 12,34,56', 'R$ 1 23,00', '(R$ -1,50)', '-R$ -1,50', 'USD 1,50', 'R$ Infinity', 'R$ 25 bananas'])('rejects %s without stripping arbitrary data', raw => {
		expect(parseCurrencyValue(raw, { currency: 'BRL', decimalSeparator: ',' })).toBeNull();
	});

	it('resolves dollar symbols from an explicit code in the same column', () => {
		expect(analyzeCurrencyColumn(['USD 10.50', '$20.00', 30])).toMatchObject({ currency: 'USD', decimalSeparator: '.' });
	});

	it('detects grouping spaces without letting them hide comma decimals', () => {
		expect(analyzeCurrencyColumn(['1\u202f234,56 €'])).toMatchObject({ currency: 'EUR', decimalSeparator: ',' });
	});

	it.each(['+BRL 10,50', 'BRL +10,50'])('detects comma decimals in explicitly positive amounts: %s', raw => {
		expect(analyzeCurrencyColumn([raw])).toMatchObject({ type: 'number', currency: 'BRL', decimalSeparator: ',' });
	});

	it('keeps grouped integers and decimal amounts in the same source format', () => {
		const values = ['USD 1,234', 'USD 2,345', 'USD 10.50'];
		const format = analyzeCurrencyColumn(values);
		expect(format).toMatchObject({ type: 'number', currency: 'USD', decimalSeparator: '.' });
		expect(values.map(value => parseCurrencyValue(value, format))).toEqual([1234, 2345, 10.5]);
		expect(analyzeCurrencyColumn(values, { decimalSeparator: ',' })).toMatchObject({ type: 'text', currencyIssue: 'invalid' });
	});

	it.each(['R$ 1.000', 'USD 1,234', 'BRL 01.234'])('requires a decimal decision for %s', raw => {
		expect(analyzeCurrencyColumn([raw])).toMatchObject({ type: 'text', currencyIssue: 'ambiguous' });
	});

	it('allows choosing a currency and source format for unresolved text', () => {
		const rows = [{ price: '$1.234,56' }, { price: null }];
		const column = { name: 'price', type: 'text', currencyIssue: 'ambiguous' };
		const result = prepareCurrencyChange(rows, column, { currency: 'USD', decimalSeparator: ',' });
		expect(result).toMatchObject({ ok: true, column: { type: 'number', currency: 'USD' }, rows: [{ price: 1234.56 }, { price: null }] });
		expect(result.column.currencyIssue).toBeUndefined();
		expect(rows[0].price).toBe('$1.234,56');
		expect(column.type).toBe('text');
	});

	it('never converts numeric values when the currency or source separator changes', () => {
		const result = prepareCurrencyChange([{ price: 1234.56 }], { name: 'price', type: 'number', currency: 'BRL' }, { currency: 'USD', decimalSeparator: ',' });
		expect(result.rows).toEqual([{ price: 1234.56 }]);
		expect(result.column.currency).toBe('USD');
	});
});
