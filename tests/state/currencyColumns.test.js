import { describe, expect, it, vi } from 'vitest';
import { createDataStateFacade } from '../../src/state/dataStateFacade.js';
import { STATE_EVENTS } from '../../src/state/stateEvents.js';

describe('currency column writes', () => {
	it('updates the original dataset after selection changes and replaces persisted references', () => {
		const dataset = { id: 'one', rows: [{ value: '$10.50' }], columns: [{ name: 'value', type: 'text' }], precomputedStats: {} };
		const other = { id: 'two', rows: [], columns: [] };
		const appState = { data: { datasets: [dataset, other], activeIndex: 1 } };
		const emitStateChange = vi.fn();
		const facade = createDataStateFacade({ appState, emitStateChange });
		const oldRows = dataset.rows;
		const oldColumns = dataset.columns;
		expect(facade.setDatasetColumnCurrency('one', 'value', { currency: 'USD' })).toEqual({ ok: true });
		expect(dataset.rows).toEqual([{ value: 10.5 }]);
		expect(dataset.rows).not.toBe(oldRows);
		expect(dataset.columns).not.toBe(oldColumns);
		expect(dataset.precomputedStats).toBeUndefined();
		expect(emitStateChange).toHaveBeenCalledWith(STATE_EVENTS.DATASET_COLUMNS_CHANGED, { datasetId: 'one', columnName: 'value' });
		expect(other.rows).toEqual([]);
	});

	it('rejects a conflicting currency without partial mutation or a save event', () => {
		const dataset = { id: 'one', rows: [{ value: 'BRL 10,00' }, { value: 'USD 20,00' }], columns: [{ name: 'value', type: 'text' }] };
		const before = structuredClone(dataset);
		const emitStateChange = vi.fn();
		const facade = createDataStateFacade({ appState: { data: { datasets: [dataset], activeIndex: 0 } }, emitStateChange });
		expect(facade.setDatasetColumnCurrency('one', 'value', { currency: 'BRL', decimalSeparator: ',' })).toEqual({ ok: false, reason: 'mixed' });
		expect(dataset).toEqual(before);
		expect(emitStateChange).not.toHaveBeenCalled();
	});
});
