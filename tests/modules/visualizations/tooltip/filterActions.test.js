// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { buildCategoricalFilterActions } from '../../../../src/modules/visualizations/tooltip/filterActions.js';

describe('tooltip/filterActions (standalone, no overlay singleton)', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('unfiltered token offers focus + add + exclude with the right variants', () => {
		const actions = buildCategoricalFilterActions({
			column: 'city',
			token: 'oslo',
			state: null,
			labels: { focus: 'Only', add: 'Keep', exclude: 'Drop' },
			onFocus: () => {},
			onAdd: () => {},
			onExclude: () => {},
		});
		expect(actions.map(a => a.label)).toEqual(['Only', 'Keep', 'Drop']);
		expect(actions[0].variant).toBe('primary');
		expect(actions[2].variant).toBe('danger');
	});

	it('included token swaps add/exclude for a single remove action', () => {
		const actions = buildCategoricalFilterActions({
			column: 'city', token: 'oslo', state: 'included',
			onFocus: () => {}, onAdd: () => {}, onExclude: () => {}, onRemove: () => {},
		});
		expect(actions.map(a => a.label)).toEqual(['Show only this', 'Remove from filter']);
	});

	it('excluded token offers bring back', () => {
		const actions = buildCategoricalFilterActions({
			column: 'city', token: 'oslo', state: 'excluded',
			onBringBack: () => {},
		});
		expect(actions.map(a => a.label)).toEqual(['Bring back']);
	});

	it('omitFocus drops the focus action even when onFocus is supplied', () => {
		const actions = buildCategoricalFilterActions({
			column: 'city', token: 'oslo', state: null, omitFocus: true,
			onFocus: () => {}, onAdd: () => {},
		});
		expect(actions.map(a => a.label)).toEqual(['Add to filter']);
	});

	it('falls back to default labels and omits actions whose callbacks are absent', () => {
		const actions = buildCategoricalFilterActions({ column: 'c', token: 't', state: null, onAdd: () => {} });
		expect(actions.map(a => a.label)).toEqual(['Add to filter']);
	});

	it('wires onClick to call back with (column, token)', () => {
		const calls = [];
		const actions = buildCategoricalFilterActions({
			column: 'city', token: 'oslo', state: null,
			onAdd: (col, tok) => calls.push([col, tok]),
		});
		actions[0].onClick();
		expect(calls).toEqual([['city', 'oslo']]);
	});

	it('returns plain definition objects and creates no DOM', () => {
		const actions = buildCategoricalFilterActions({
			column: 'c', token: 't', state: null, onAdd: () => {},
		});
		expect(actions[0]).not.toBeInstanceOf(Node);
		expect(document.querySelector('.chart-tooltip')).toBeNull();
		expect(document.body.children).toHaveLength(0);
	});
});
