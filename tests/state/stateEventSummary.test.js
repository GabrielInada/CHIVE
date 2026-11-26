import { describe, expect, it } from 'vitest';
import { summarizeStateEvent } from '../../src/state/stateEventSummary.js';
import { STATE_EVENTS } from '../../src/state/stateEvents.js';
import { CHART_TYPE_KEYS } from '../../src/config/charts/definitions.js';

const summarize = (type, data) => summarizeStateEvent(type, data, STATE_EVENTS);

describe('summarizeStateEvent', () => {
	it('reduces index payloads to safe integers', () => {
		expect(summarize(STATE_EVENTS.ACTIVE_DATASET_CHANGED, 2)).toEqual({ index: 2 });
		expect(summarize(STATE_EVENTS.DATASET_REMOVED, 0)).toEqual({ index: 0 });
		expect(summarize(STATE_EVENTS.DATASET_REMOVED, '2')).toEqual({ index: null });
		expect(summarize(STATE_EVENTS.DATASET_REMOVED, 1.5)).toEqual({ index: null });
		expect(summarize(STATE_EVENTS.DATASET_REMOVED, Number.MAX_SAFE_INTEGER + 1)).toEqual({ index: null });
	});

	it('counts dataset rows and columns without echoing their contents', () => {
		const dataset = {
			name: 'secret.csv',
			rows: [{ email: 'a@example.test' }, { email: 'b@example.test' }],
			columns: [{ name: 'email' }],
		};

		const summary = summarize(STATE_EVENTS.DATASET_ADDED, { index: 3, dataset });

		expect(summary).toEqual({ index: 3, rowsCount: 2, columnsCount: 1 });
		expect(JSON.stringify(summary)).not.toMatch(/secret|email|example/);
	});

	it('reports null counts for a malformed dataset payload', () => {
		expect(summarize(STATE_EVENTS.DATASET_ADDED, undefined)).toEqual({
			index: null,
			rowsCount: null,
			columnsCount: null,
		});
		expect(summarize(STATE_EVENTS.DATASET_ADDED, { index: 1, dataset: { rows: 'x', columns: {} } })).toEqual({
			index: 1,
			rowsCount: null,
			columnsCount: null,
		});
	});

	it('lists only the known config fields that changed, never their values', () => {
		const chartKey = CHART_TYPE_KEYS[0];
		const summary = summarize(STATE_EVENTS.DATASET_CONFIG_UPDATED, {
			activeTab: 'table',
			globalFilter: { tokens: ['region = North'] },
			[chartKey]: { category: 'salary' },
			unrelatedField: 'ignored',
		});

		expect(summary).toEqual({ fields: ['activeTab', 'globalFilter', chartKey] });
		expect(JSON.stringify(summary)).not.toMatch(/North|salary|ignored/);
		expect(summarize(STATE_EVENTS.DATASET_CONFIG_UPDATED, null)).toEqual({ fields: [] });
	});

	it('ignores config keys inherited through the prototype', () => {
		const inherited = Object.create({ activeTab: 'table' });
		expect(summarize(STATE_EVENTS.DATASET_CONFIG_UPDATED, inherited)).toEqual({ fields: [] });
	});

	it('counts selected columns', () => {
		expect(summarize(STATE_EVENTS.COLUMN_SELECTION_CHANGED, ['a', 'b', 'c'])).toEqual({ columnsCount: 3 });
		expect(summarize(STATE_EVENTS.COLUMN_SELECTION_CHANGED, 'a')).toEqual({ columnsCount: null });
	});

	it('counts snapshot rows and columns by id', () => {
		const snapshot = { title: 'Private title', dataSnapshot: [{}, {}, {}], columnsSnapshot: [{ name: 'salary' }] };
		const summary = summarize(STATE_EVENTS.CHART_SNAPSHOT_ADDED, { id: 7, snapshot });

		expect(summary).toEqual({ id: 7, rowsCount: 3, columnsCount: 1 });
		expect(JSON.stringify(summary)).not.toMatch(/Private|salary/);
		expect(summarize(STATE_EVENTS.CHART_SNAPSHOT_ADDED, {})).toEqual({ id: null, rowsCount: null, columnsCount: null });
		expect(summarize(STATE_EVENTS.CHART_SNAPSHOT_REMOVED, 7)).toEqual({ id: 7 });
	});

	it('projects panel payloads to their numeric or boolean fields', () => {
		expect(summarize(STATE_EVENTS.PANEL_PLACEMENTS_UPDATED, { count: 4 })).toEqual({ count: 4 });
		expect(summarize(STATE_EVENTS.PANEL_BLOCK_MOVED, { targetIndex: 1, blockId: 'b1' })).toEqual({ targetIndex: 1 });
		expect(summarize(STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED, { heightPx: 320 })).toEqual({ heightPx: 320 });
		expect(summarize(STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED, { heightPx: '320' })).toEqual({ heightPx: null });
		expect(summarize(STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED, { enabled: false })).toEqual({ enabled: false });
		expect(summarize(STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED, { enabled: 'yes' })).toEqual({ enabled: null });
	});

	it('keeps preview rows and only the known sidebar modes', () => {
		expect(summarize(STATE_EVENTS.PREVIEW_ROWS_CHANGED, 50)).toEqual({ rows: 50 });
		for (const mode of ['data', 'viz', 'panel']) {
			expect(summarize(STATE_EVENTS.SIDEBAR_MODE_CHANGED, mode)).toEqual({ mode });
		}
		expect(summarize(STATE_EVENTS.SIDEBAR_MODE_CHANGED, 'secret.csv')).toEqual({ mode: null });
	});

	it('returns null for events without a projection and for unknown types', () => {
		expect(summarize(STATE_EVENTS.PANEL_CLEARED, { anything: true })).toBeNull();
		expect(summarize('not-an-event', 'secret')).toBeNull();
	});

	it('returns null instead of throwing when a payload getter throws', () => {
		const hostile = {
			get index() { throw new Error('boom'); },
		};
		expect(summarize(STATE_EVENTS.DATASET_ADDED, hostile)).toBeNull();
	});
});
