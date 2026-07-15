// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderColumnControlsDOM } from '../../../../src/features/datasetWorkspace/views/columnControlsView.js';

describe('columnControlsView', () => {
	it('renders action buttons and checkbox list, then emits selections', () => {
		document.body.innerHTML = '<div id="acoes"></div><div id="lista"></div>';
		const actionsContainer = document.getElementById('acoes');
		const columnsList = document.getElementById('lista');
		const onColumnSelectionChange = vi.fn();

		renderColumnControlsDOM({
			actionsContainer,
			columnsList,
			columns: [
				{ name: 'cidade', type: 'text' },
				{ name: 'valor', type: 'number' },
			],
			selectedNames: new Set(['cidade']),
			activeFilter: 'text',
			columnNames: ['cidade', 'valor'],
			numericNames: ['valor'],
			textNames: ['cidade'],
			translate: key => key,
			translateType: type => type,
			onColumnSelectionChange,
		});

		expect(actionsContainer.querySelectorAll('[data-acao-coluna]').length).toBe(4);
		expect(columnsList.querySelectorAll('.column-checkbox').length).toBe(2);

		actionsContainer.querySelector('[data-acao-coluna="numeric"]').click();
		expect(onColumnSelectionChange).toHaveBeenCalledWith(['valor']);

		const checkboxes = columnsList.querySelectorAll('.column-checkbox');
		checkboxes[1].checked = true;
		checkboxes[1].dispatchEvent(new Event('change', { bubbles: true }));
		expect(onColumnSelectionChange).toHaveBeenCalledWith(['cidade', 'valor']);
	});

	it('handles all, clear, and text action buttons', () => {
		document.body.innerHTML = '<div id="acoes"></div><div id="lista"></div>';
		const onColumnSelectionChange = vi.fn();

		renderColumnControlsDOM({
			actionsContainer: document.getElementById('acoes'),
			columnsList: document.getElementById('lista'),
			columns: [
				{ name: 'cidade', type: 'text' },
				{ name: 'valor', type: 'number' },
			],
			selectedNames: new Set(['cidade', 'valor']),
			activeFilter: 'all',
			columnNames: ['cidade', 'valor'],
			numericNames: ['valor'],
			textNames: ['cidade'],
			translate: key => key,
			translateType: type => type,
			onColumnSelectionChange,
		});

		expect(document.querySelector('[data-acao-coluna="all"]').classList.contains('active')).toBe(true);
		document.querySelector('[data-acao-coluna="all"]').click();
		document.querySelector('[data-acao-coluna="clear"]').click();
		document.querySelector('[data-acao-coluna="text"]').click();

		expect(onColumnSelectionChange).toHaveBeenNthCalledWith(1, ['cidade', 'valor']);
		expect(onColumnSelectionChange).toHaveBeenNthCalledWith(2, []);
		expect(onColumnSelectionChange).toHaveBeenNthCalledWith(3, ['cidade']);
	});

	it('guards missing callbacks and non-checkbox change events', () => {
		document.body.innerHTML = '<div id="acoes"></div><div id="lista"></div>';
		const actionsContainer = document.getElementById('acoes');
		const columnsList = document.getElementById('lista');

		renderColumnControlsDOM({
			actionsContainer,
			columnsList,
			columns: [{ name: 'cidade', type: 'text' }],
			selectedNames: new Set(),
			activeFilter: 'text',
			columnNames: ['cidade'],
			numericNames: [],
			textNames: ['cidade'],
			translate: key => key,
			translateType: type => type,
		});

		expect(document.querySelector('[data-acao-coluna="text"]').classList.contains('active')).toBe(true);
		expect(() => {
			actionsContainer.click();
			document.querySelector('[data-acao-coluna="text"]').click();
			columnsList.dispatchEvent(new Event('change', { bubbles: true }));
		}).not.toThrow();
	});
});
