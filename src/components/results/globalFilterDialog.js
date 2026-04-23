import {
	FILTER_CATEGORY_LIMIT,
	createDefaultFilterConfig,
	getCategoricalFilterOptions,
	normalizeFilterConfig,
} from '../../utils/chartFilters.js';

function cloneFilter(filter) {
	return JSON.parse(JSON.stringify(filter || createDefaultFilterConfig()));
}

function createOption(value, label, selected = false) {
	const option = document.createElement('option');
	option.value = String(value);
	option.textContent = label;
	option.selected = selected;
	return option;
}

function renderNumericBody({ body, draft, translate }) {
	body.innerHTML = '';

	const opWrap = document.createElement('div');
	opWrap.className = 'gf-control';
	const opLabel = document.createElement('label');
	opLabel.htmlFor = 'gf-operator';
	opLabel.textContent = translate('chive-chart-filter-operator');
	const opSelect = document.createElement('select');
	opSelect.id = 'gf-operator';
	opSelect.className = 'linhas-select';
	[
		{ value: 'between', label: translate('chive-chart-filter-op-between') },
		{ value: 'lt', label: translate('chive-chart-filter-op-lt') },
		{ value: 'gt', label: translate('chive-chart-filter-op-gt') },
		{ value: 'eq', label: translate('chive-chart-filter-op-eq') },
	].forEach(option => opSelect.appendChild(createOption(option.value, option.label, option.value === draft.operator)));
	opWrap.appendChild(opLabel);
	opWrap.appendChild(opSelect);
	body.appendChild(opWrap);

	const inputsWrap = document.createElement('div');
	inputsWrap.className = 'gf-numeric-inputs';

	const renderInputs = () => {
		inputsWrap.innerHTML = '';
		if (draft.operator === 'between') {
			const minWrap = document.createElement('div');
			minWrap.className = 'gf-control';
			const minLabel = document.createElement('label');
			minLabel.htmlFor = 'gf-min';
			minLabel.textContent = translate('chive-chart-filter-min');
			const minInput = document.createElement('input');
			minInput.id = 'gf-min';
			minInput.type = 'number';
			minInput.className = 'linhas-select';
			minInput.value = String(draft.min ?? '');
			minInput.addEventListener('input', () => { draft.min = minInput.value; });
			minWrap.appendChild(minLabel);
			minWrap.appendChild(minInput);
			inputsWrap.appendChild(minWrap);

			const maxWrap = document.createElement('div');
			maxWrap.className = 'gf-control';
			const maxLabel = document.createElement('label');
			maxLabel.htmlFor = 'gf-max';
			maxLabel.textContent = translate('chive-chart-filter-max');
			const maxInput = document.createElement('input');
			maxInput.id = 'gf-max';
			maxInput.type = 'number';
			maxInput.className = 'linhas-select';
			maxInput.value = String(draft.max ?? '');
			maxInput.addEventListener('input', () => { draft.max = maxInput.value; });
			maxWrap.appendChild(maxLabel);
			maxWrap.appendChild(maxInput);
			inputsWrap.appendChild(maxWrap);
		} else {
			const valueWrap = document.createElement('div');
			valueWrap.className = 'gf-control';
			const valueLabel = document.createElement('label');
			valueLabel.htmlFor = 'gf-value';
			valueLabel.textContent = translate('chive-chart-filter-value');
			const valueInput = document.createElement('input');
			valueInput.id = 'gf-value';
			valueInput.type = 'number';
			valueInput.className = 'linhas-select';
			valueInput.value = String(draft.value ?? '');
			valueInput.addEventListener('input', () => { draft.value = valueInput.value; });
			valueWrap.appendChild(valueLabel);
			valueWrap.appendChild(valueInput);
			inputsWrap.appendChild(valueWrap);
		}
	};

	renderInputs();
	body.appendChild(inputsWrap);

	opSelect.addEventListener('change', () => {
		draft.operator = opSelect.value;
		renderInputs();
	});
}

function renderCategoricalBody({ body, draft, rows, translate }) {
	body.innerHTML = '';

	const searchWrap = document.createElement('div');
	searchWrap.className = 'gf-control';
	const searchLabel = document.createElement('label');
	searchLabel.htmlFor = 'gf-search';
	searchLabel.textContent = translate('chive-chart-filter-search');
	const searchInput = document.createElement('input');
	searchInput.id = 'gf-search';
	searchInput.type = 'search';
	searchInput.className = 'linhas-select';
	searchInput.value = draft.search || '';
	searchWrap.appendChild(searchLabel);
	searchWrap.appendChild(searchInput);
	body.appendChild(searchWrap);

	const actions = document.createElement('div');
	actions.className = 'gf-actions';
	const selectAllBtn = document.createElement('button');
	selectAllBtn.type = 'button';
	selectAllBtn.className = 'btn-secundario gf-action-btn';
	selectAllBtn.id = 'gf-select-all';
	selectAllBtn.textContent = translate('chive-chart-filter-select-all');
	const clearSelectionBtn = document.createElement('button');
	clearSelectionBtn.type = 'button';
	clearSelectionBtn.className = 'btn-secundario gf-action-btn';
	clearSelectionBtn.id = 'gf-clear-selection';
	clearSelectionBtn.textContent = translate('chive-chart-filter-clear');
	actions.appendChild(selectAllBtn);
	actions.appendChild(clearSelectionBtn);
	body.appendChild(actions);

	const list = document.createElement('div');
	list.className = 'gf-list';
	list.id = 'gf-list';
	body.appendChild(list);

	const summary = document.createElement('div');
	summary.className = 'gf-summary';
	body.appendChild(summary);

	const renderList = () => {
		const query = String(searchInput.value || '').trim();
		const options = getCategoricalFilterOptions(rows, draft.column, {
			search: query,
			limit: query.length > 0 ? Number.MAX_SAFE_INTEGER : FILTER_CATEGORY_LIMIT,
			missingLabel: translate('chive-chart-filter-missing'),
		});

		const includeSet = new Set(draft.include || []);
		list.innerHTML = '';
		options.options.forEach(item => {
			const row = document.createElement('label');
			row.className = 'gf-list-item';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.dataset.token = item.token;
			checkbox.checked = includeSet.has(item.token);
			checkbox.addEventListener('change', () => {
				const currentSet = new Set(draft.include || []);
				if (checkbox.checked) currentSet.add(item.token);
				else currentSet.delete(item.token);
				draft.include = Array.from(currentSet);
			});
			const text = document.createElement('span');
			text.className = 'gf-list-item-text';
			text.textContent = `${item.label} (${item.count})`;
			row.appendChild(checkbox);
			row.appendChild(text);
			list.appendChild(row);
		});

		summary.textContent = options.hasMore
			? `${translate('chive-chart-filter-showing', options.options.length, options.total)} · ${translate('chive-chart-filter-more', options.total - options.options.length)}`
			: translate('chive-chart-filter-showing', options.options.length, options.total);

		return options;
	};

	searchInput.addEventListener('input', () => {
		draft.search = searchInput.value;
		renderList();
	});

	selectAllBtn.addEventListener('click', () => {
		const options = getCategoricalFilterOptions(rows, draft.column, {
			search: '',
			limit: Number.MAX_SAFE_INTEGER,
			missingLabel: translate('chive-chart-filter-missing'),
		});
		draft.include = options.allTokens.slice();
		renderList();
	});

	clearSelectionBtn.addEventListener('click', () => {
		draft.include = [];
		renderList();
	});

	renderList();
}

function renderDialogBody({ body, draft, rows, numericColumns, translate }) {
	if (!draft.column) {
		body.innerHTML = '';
		const empty = document.createElement('div');
		empty.className = 'gf-empty';
		empty.textContent = translate('chive-global-filter-empty');
		body.appendChild(empty);
		return;
	}

	if (numericColumns.includes(draft.column)) {
		draft.mode = 'numeric';
		renderNumericBody({ body, draft, translate });
	} else {
		draft.mode = 'categorical';
		renderCategoricalBody({ body, draft, rows, translate });
	}
}

export function openGlobalFilterDialog({
	rows,
	allColumns,
	numericColumns,
	initialFilter,
	translate,
	onApply,
	onClear,
}) {
	return new Promise(resolve => {
		const overlay = document.createElement('div');
		overlay.className = 'join-overlay gf-overlay';

		const dialog = document.createElement('div');
		dialog.className = 'join-dialog gf-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');

		const title = document.createElement('h3');
		title.className = 'join-title';
		title.textContent = translate('chive-global-filter-dialog-title');
		dialog.appendChild(title);

		const safeInitial = normalizeFilterConfig(initialFilter, numericColumns);
		if (safeInitial.column && !allColumns.includes(safeInitial.column)) {
			safeInitial.column = null;
			safeInitial.include = [];
		}

		const draft = cloneFilter(safeInitial);
		if (!draft.column) {
			// Keep default reset state
			draft.include = [];
			draft.search = '';
		}

		const controls = document.createElement('div');
		controls.className = 'gf-controls';

		const columnWrap = document.createElement('div');
		columnWrap.className = 'gf-control';
		const columnLabel = document.createElement('label');
		columnLabel.htmlFor = 'gf-column';
		columnLabel.textContent = translate('chive-chart-filter-column');
		const columnSelect = document.createElement('select');
		columnSelect.id = 'gf-column';
		columnSelect.className = 'linhas-select';
		columnSelect.appendChild(createOption('', translate('chive-chart-option-none'), !draft.column));
		allColumns.forEach(name => {
			columnSelect.appendChild(createOption(name, name, draft.column === name));
		});
		columnWrap.appendChild(columnLabel);
		columnWrap.appendChild(columnSelect);
		controls.appendChild(columnWrap);

		dialog.appendChild(controls);

		const body = document.createElement('div');
		body.className = 'gf-body';
		dialog.appendChild(body);

		const footer = document.createElement('div');
		footer.className = 'join-footer gf-footer';
		const cancelBtn = document.createElement('button');
		cancelBtn.type = 'button';
		cancelBtn.className = 'btn-secundario';
		cancelBtn.id = 'gf-cancel';
		cancelBtn.textContent = translate('chive-global-filter-cancel');
		const clearBtn = document.createElement('button');
		clearBtn.type = 'button';
		clearBtn.className = 'btn-secundario';
		clearBtn.id = 'gf-clear';
		clearBtn.textContent = translate('chive-global-filter-clear');
		const applyBtn = document.createElement('button');
		applyBtn.type = 'button';
		applyBtn.className = 'btn-primario';
		applyBtn.id = 'gf-apply';
		applyBtn.textContent = translate('chive-global-filter-apply');
		footer.appendChild(cancelBtn);
		footer.appendChild(clearBtn);
		footer.appendChild(applyBtn);
		dialog.appendChild(footer);

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		const onEscape = event => {
			if (event.key !== 'Escape') return;
			closeDialog('cancel', null);
		};

		const closeDialog = (action, filterOut) => {
			document.removeEventListener('keydown', onEscape);
			overlay.remove();
			resolve({ action, filter: filterOut });
		};

		renderDialogBody({ body, draft, rows, numericColumns, translate });

		columnSelect.addEventListener('change', () => {
			const nextColumn = columnSelect.value || null;
			if (!nextColumn) {
				draft.column = null;
				draft.include = [];
				draft.search = '';
				renderDialogBody({ body, draft, rows, numericColumns, translate });
				return;
			}
			draft.column = nextColumn;
			if (numericColumns.includes(nextColumn)) {
				draft.mode = 'numeric';
				draft.operator = 'between';
				draft.min = '';
				draft.max = '';
				draft.value = '';
			} else {
				draft.mode = 'categorical';
				const options = getCategoricalFilterOptions(rows, nextColumn, {
					search: '',
					limit: Number.MAX_SAFE_INTEGER,
					missingLabel: translate('chive-chart-filter-missing'),
				});
				draft.include = options.allTokens.slice();
				draft.search = '';
			}
			renderDialogBody({ body, draft, rows, numericColumns, translate });
		});

		cancelBtn.addEventListener('click', () => closeDialog('cancel', null));

		clearBtn.addEventListener('click', () => {
			const cleared = createDefaultFilterConfig();
			if (typeof onClear === 'function') {
				onClear(cleared);
			}
			closeDialog('clear', cleared);
		});

		applyBtn.addEventListener('click', () => {
			const applied = cloneFilter(draft);
			if (typeof onApply === 'function') {
				onApply(applied);
			}
			closeDialog('apply', applied);
		});

		overlay.addEventListener('click', event => {
			if (event.target === overlay) {
				closeDialog('cancel', null);
			}
		});

		document.addEventListener('keydown', onEscape);
	});
}