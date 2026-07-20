// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/charts/previews.js', () => ({
	CHART_PREVIEWS: {
		bar: '<svg data-prev="bar" />',
		line: '<svg data-prev="line" />',
		scatter: '<svg data-prev="scatter" />',
		scatter3d: '<svg data-prev="scatter3d" />',
		pie: '<svg data-prev="pie" />',
		bubble: '<svg data-prev="bubble" />',
		network: '<svg data-prev="network" />',
		treemap: '<svg data-prev="treemap" />',
		tin: '<svg data-prev="tin" />',
	},
}));

import { openChartTypePickerDialog } from '../../../../src/features/datasetWorkspace/dialogs/chartTypePickerDialog.js';
import { CHART_TYPE_KEYS } from '../../../../src/config/charts/definitions.js';

const translate = key => `t:${key}`;

function getDialog() {
	return document.body.querySelector('dialog.app-dialog');
}

function getCards() {
	return Array.from(document.querySelectorAll('.chart-picker-card'));
}

describe('openChartTypePickerDialog', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders one card per canonical chart type in order', () => {
		openChartTypePickerDialog({ activeChartType: null, translate });
		const types = getCards().map(card => card.dataset.chartType);
		expect(types).toEqual(CHART_TYPE_KEYS);
	});

	it('marks the active chart card with .selected', () => {
		openChartTypePickerDialog({ activeChartType: 'pie', translate });
		const selected = document.querySelectorAll('.chart-picker-card.selected');
		expect(selected.length).toBe(1);
		expect(selected[0].dataset.chartType).toBe('pie');
	});

	it('renders no .selected card when activeChartType is null', () => {
		openChartTypePickerDialog({ activeChartType: null, translate });
		expect(document.querySelectorAll('.chart-picker-card.selected').length).toBe(0);
	});

	it('clicking a card resolves with { chartType } and removes the dialog', async () => {
		const promise = openChartTypePickerDialog({ activeChartType: null, translate });
		const scatterCard = document.querySelector('[data-chart-type="scatter"]');
		scatterCard.click();
		const result = await promise;
		expect(result).toEqual({ chartType: 'scatter' });
		expect(getDialog()).toBeNull();
	});

	it('clicking Clear resolves with { chartType: null }', async () => {
		const promise = openChartTypePickerDialog({ activeChartType: 'bar', translate });
		const clearBtn = Array.from(document.querySelectorAll('.btn-secondary'))
			.find(b => b.textContent === translate('chive-chart-picker-clear'));
		clearBtn.click();
		const result = await promise;
		expect(result).toEqual({ chartType: null });
		expect(getDialog()).toBeNull();
	});

	it('clicking Cancel resolves with null', async () => {
		const promise = openChartTypePickerDialog({ activeChartType: 'bar', translate });
		const cancelBtn = Array.from(document.querySelectorAll('.btn-secondary'))
			.find(b => b.textContent === translate('chive-chart-picker-cancel'));
		cancelBtn.click();
		const result = await promise;
		expect(result).toBeNull();
		expect(getDialog()).toBeNull();
	});

	it('pressing Escape resolves with null', async () => {
		const promise = openChartTypePickerDialog({ activeChartType: null, translate });
		getDialog().dispatchEvent(new Event('cancel', { cancelable: true }));
		const result = await promise;
		expect(result).toBeNull();
		expect(getDialog()).toBeNull();
	});

	it('clicking the backdrop resolves with null', async () => {
		const promise = openChartTypePickerDialog({ activeChartType: null, translate });
		getDialog().click();
		const result = await promise;
		expect(result).toBeNull();
	});

	it('clicking the dialog itself (not the backdrop) does not close', () => {
		openChartTypePickerDialog({ activeChartType: null, translate });
		const surface = document.querySelector('.chart-picker-dialog');
		surface.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(getDialog()).not.toBeNull();
	});
});
