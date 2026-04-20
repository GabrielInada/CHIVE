import { t } from '../../services/i18nService.js';
import { formatNumber, translateType, isEmptyValue } from '../../utils/formatters.js';

export function renderTablePreview(rows, visibleColumns, limit) {
	const tableContainer = document.getElementById('container-tabela');
	if (visibleColumns.length === 0) {
		tableContainer.innerHTML = '';
		const empty = document.createElement('div');
		empty.className = 'tabela-sem-colunas';
		empty.textContent = t('chive-no-columns-selected');
		tableContainer.appendChild(empty);
		return;
	}

	const previewRows = rows.slice(0, limit);
	const table = document.createElement('table');
	table.className = 'tabela-preview';

	const thead = document.createElement('thead');
	const trHead = document.createElement('tr');
	visibleColumns.forEach(({ nome, tipo }) => {
		const th = document.createElement('th');
		if (tipo === 'numero') th.classList.add('num');
		th.textContent = nome;
		trHead.appendChild(th);
	});
	thead.appendChild(trHead);

	const tbody = document.createElement('tbody');
	previewRows.forEach(row => {
		const tr = document.createElement('tr');
		visibleColumns.forEach(({ nome, tipo }) => {
			const td = document.createElement('td');
			if (tipo === 'numero') td.classList.add('num');
			const value = row[nome];
			const displayValue = isEmptyValue(value)
				? '—'
				: (tipo === 'numero' ? formatNumber(value) : String(value));
			td.textContent = displayValue;
			tr.appendChild(td);
		});
		tbody.appendChild(tr);
	});

	const tfoot = document.createElement('tfoot');
	const trFoot = document.createElement('tr');
	visibleColumns.forEach(({ tipo }) => {
		const td = document.createElement('td');
		td.textContent = translateType(tipo);
		trFoot.appendChild(td);
	});
	tfoot.appendChild(trFoot);

	table.appendChild(thead);
	table.appendChild(tbody);
	table.appendChild(tfoot);

	tableContainer.innerHTML = '';
	tableContainer.appendChild(table);
}
