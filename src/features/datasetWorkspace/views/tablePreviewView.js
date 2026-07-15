/**
 * Table preview view. Builds the `<table>` element with row index, typed
 * cells (numeric/text), and a footer row showing per-column type tags.
 */

import { t, translateType, getLocale } from '../../../services/i18nService.js';
import { formatNumber, isEmptyValue } from '../../../utils/formatters.js';

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
	const tableContainer = document.getElementById('table-container');
	if (visibleColumns.length === 0) {
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
	previewRows.forEach((row, i) => {
		const tr = document.createElement('tr');
		const tdIndex = document.createElement('td');
		tdIndex.classList.add('row-index');
		tdIndex.textContent = String(i + 1);
		tr.appendChild(tdIndex);
		visibleColumns.forEach(({ name, type }) => {
			const td = document.createElement('td');
			if (type === 'number') td.classList.add('num');
			const value = row[name];
			const displayValue = isEmptyValue(value)
				? '—'
				: (type === 'number' ? formatNumber(value, locale) : String(value));
			td.textContent = displayValue;
			tr.appendChild(td);
		});
		tbody.appendChild(tr);
	});

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
}
