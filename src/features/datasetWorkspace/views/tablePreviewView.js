/**
 * Table preview view. Builds the `<table>` element with row index, typed
 * cells (numeric/text), and a footer row showing per-column type tags.
 */

import { t, translateType, getLocale } from '../../../services/i18nService.js';
import { formatNumber, isEmptyValue } from '../../../utils/formatters.js';
import { VIEW_IDS } from '../domIds.js';

const SYNC_CELL_BUDGET = 2000;
const CHUNK_CELL_BUDGET = 2000;
let renderEpoch = 0;

/**
 * @param {HTMLTableSectionElement} tbody
 * @param {Array<Object<string, *>>} rows
 * @param {Array<{ name: string, type: string }>} visibleColumns
 * @param {string} locale
 * @param {number} start
 * @param {number} end
 */
function appendRows(tbody, rows, visibleColumns, locale, start, end) {
	const fragment = document.createDocumentFragment();
	for (let index = start; index < end; index += 1) {
		const row = rows[index];
		const tr = document.createElement('tr');
		const tdIndex = document.createElement('td');
		tdIndex.classList.add('row-index');
		tdIndex.textContent = String(index + 1);
		tr.appendChild(tdIndex);
		visibleColumns.forEach(({ name, type }) => {
			const td = document.createElement('td');
			if (type === 'number') td.classList.add('num');
			const value = row[name];
			td.textContent = isEmptyValue(value)
				? '—'
				: (type === 'number' ? formatNumber(value, locale) : String(value));
			tr.appendChild(td);
		});
		fragment.appendChild(tr);
	}
	tbody.appendChild(fragment);
}

/**
 * Render the preview table into `#table-container`. Caps rows at `limit`.
 * Renders a "no columns selected" placeholder when `visibleColumns` is
 * empty.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {Array<{ name: string, type: string }>} visibleColumns
 * @param {number} limit
 * @returns {void}
 */
export function renderTablePreview(rows, visibleColumns, limit) {
	const epoch = ++renderEpoch;
	const tableContainer = document.getElementById(VIEW_IDS.tableContainer);
	if (visibleColumns.length === 0) {
		tableContainer.removeAttribute('aria-busy');
		tableContainer.replaceChildren();
		const empty = document.createElement('div');
		empty.className = 'table-no-columns';
		empty.textContent = t('chive-no-columns-selected');
		tableContainer.appendChild(empty);
		return;
	}

	const previewRows = rows.slice(0, limit);
	const locale = getLocale();
	const table = document.createElement('table');
	table.className = 'table-preview';

	const thead = document.createElement('thead');
	const trHead = document.createElement('tr');
	const thIndex = document.createElement('th');
	thIndex.classList.add('row-index');
	thIndex.textContent = '#';
	trHead.appendChild(thIndex);
	visibleColumns.forEach(({ name, type }) => {
		const th = document.createElement('th');
		if (type === 'number') th.classList.add('num');
		th.textContent = name;
		trHead.appendChild(th);
	});
	thead.appendChild(trHead);

	const tbody = document.createElement('tbody');

	const tfoot = document.createElement('tfoot');
	const trFoot = document.createElement('tr');
	const tdFootIndex = document.createElement('td');
	tdFootIndex.classList.add('row-index');
	trFoot.appendChild(tdFootIndex);
	visibleColumns.forEach(({ type }) => {
		const td = document.createElement('td');
		td.textContent = translateType(type);
		trFoot.appendChild(td);
	});
	tfoot.appendChild(trFoot);

	table.appendChild(thead);
	table.appendChild(tbody);
	table.appendChild(tfoot);

	tableContainer.replaceChildren();
	tableContainer.appendChild(table);

	const cellsPerRow = visibleColumns.length + 1;
	const totalCells = previewRows.length * cellsPerRow;
	if (totalCells <= SYNC_CELL_BUDGET) {
		tableContainer.removeAttribute('aria-busy');
		appendRows(tbody, previewRows, visibleColumns, locale, 0, previewRows.length);
		return;
	}

	tableContainer.setAttribute('aria-busy', 'true');
	const rowsPerChunk = Math.max(1, Math.floor(CHUNK_CELL_BUDGET / cellsPerRow));
	let nextRow = 0;
	const appendChunk = () => {
		if (epoch !== renderEpoch || !table.isConnected) return;
		const end = Math.min(previewRows.length, nextRow + rowsPerChunk);
		appendRows(tbody, previewRows, visibleColumns, locale, nextRow, end);
		nextRow = end;
		if (nextRow < previewRows.length) {
			window.setTimeout(appendChunk, 0);
		} else {
			tableContainer.removeAttribute('aria-busy');
		}
	};
	window.setTimeout(appendChunk, 0);
}
