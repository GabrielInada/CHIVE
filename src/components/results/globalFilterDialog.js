import {
	FILTER_CATEGORY_LIMIT,
	createDefaultFilterConfig,
	getCategoricalFilterOptions,
	normalizeFilterConfig,
} from '../../utils/chartFilters.js';
import { createEmptyGlobalFilter, normalizeGlobalFilter } from '../../utils/globalFilter.js';

let nextRuleUid = 1;

function cloneRule(rule) {
	return JSON.parse(JSON.stringify(rule || createDefaultFilterConfig()));
}

function createEmptyRuleDraft() {
	return {
		_uid: nextRuleUid++,
		...createDefaultFilterConfig(),
	};
}

function ruleFromExisting(rule) {
	return {
		_uid: nextRuleUid++,
		...cloneRule(rule),
	};
}

function stripUid(rule) {
	const { _uid, ...rest } = rule;
	return rest;
}

function createOption(value, label, selected = false) {
	const option = document.createElement('option');
	option.value = String(value);
	option.textContent = label;
	option.selected = selected;
	return option;
}

function renderNumericRuleBody({ body, rule, translate }) {
	body.innerHTML = '';

	const opWrap = document.createElement('div');
	opWrap.className = 'gf-control';
	const opLabel = document.createElement('label');
	opLabel.textContent = translate('chive-chart-filter-operator');
	const opSelect = document.createElement('select');
	opSelect.className = 'linhas-select gf-rule-operator';
	[
		{ value: 'between', label: translate('chive-chart-filter-op-between') },
		{ value: 'lt', label: translate('chive-chart-filter-op-lt') },
		{ value: 'gt', label: translate('chive-chart-filter-op-gt') },
		{ value: 'eq', label: translate('chive-chart-filter-op-eq') },
	].forEach(option => opSelect.appendChild(createOption(option.value, option.label, option.value === rule.operator)));
	opWrap.appendChild(opLabel);
	opWrap.appendChild(opSelect);
	body.appendChild(opWrap);

	const inputsWrap = document.createElement('div');
	inputsWrap.className = 'gf-numeric-inputs';

	const renderInputs = () => {
		inputsWrap.innerHTML = '';
		if (rule.operator === 'between') {
			const minWrap = document.createElement('div');
			minWrap.className = 'gf-control';
			const minLabel = document.createElement('label');
			minLabel.textContent = translate('chive-chart-filter-min');
			const minInput = document.createElement('input');
			minInput.type = 'number';
			minInput.className = 'linhas-select';
			minInput.value = String(rule.min ?? '');
			minInput.addEventListener('input', () => { rule.min = minInput.value; });
			minWrap.appendChild(minLabel);
			minWrap.appendChild(minInput);
			inputsWrap.appendChild(minWrap);

			const maxWrap = document.createElement('div');
			maxWrap.className = 'gf-control';
			const maxLabel = document.createElement('label');
			maxLabel.textContent = translate('chive-chart-filter-max');
			const maxInput = document.createElement('input');
			maxInput.type = 'number';
			maxInput.className = 'linhas-select';
			maxInput.value = String(rule.max ?? '');
			maxInput.addEventListener('input', () => { rule.max = maxInput.value; });
			maxWrap.appendChild(maxLabel);
			maxWrap.appendChild(maxInput);
			inputsWrap.appendChild(maxWrap);
		} else {
			const valueWrap = document.createElement('div');
			valueWrap.className = 'gf-control';
			const valueLabel = document.createElement('label');
			valueLabel.textContent = translate('chive-chart-filter-value');
			const valueInput = document.createElement('input');
			valueInput.type = 'number';
			valueInput.className = 'linhas-select';
			valueInput.value = String(rule.value ?? '');
			valueInput.addEventListener('input', () => { rule.value = valueInput.value; });
			valueWrap.appendChild(valueLabel);
			valueWrap.appendChild(valueInput);
			inputsWrap.appendChild(valueWrap);
		}
	};

	renderInputs();
	body.appendChild(inputsWrap);

	opSelect.addEventListener('change', () => {
		rule.operator = opSelect.value;
		renderInputs();
	});
}

function renderCategoricalRuleBody({ body, rule, rows, translate }) {
	body.innerHTML = '';

	const searchWrap = document.createElement('div');
	searchWrap.className = 'gf-control';
	const searchLabel = document.createElement('label');
	searchLabel.textContent = translate('chive-chart-filter-search');
	const searchInput = document.createElement('input');
	searchInput.type = 'search';
	searchInput.className = 'linhas-select gf-rule-search';
	searchInput.value = rule.search || '';
	searchWrap.appendChild(searchLabel);
	searchWrap.appendChild(searchInput);
	body.appendChild(searchWrap);

	const actions = document.createElement('div');
	actions.className = 'gf-actions';
	const selectAllBtn = document.createElement('button');
	selectAllBtn.type = 'button';
	selectAllBtn.className = 'btn-secundario gf-action-btn gf-rule-select-all';
	selectAllBtn.textContent = translate('chive-chart-filter-select-all');
	const clearSelectionBtn = document.createElement('button');
	clearSelectionBtn.type = 'button';
	clearSelectionBtn.className = 'btn-secundario gf-action-btn gf-rule-clear-selection';
	clearSelectionBtn.textContent = translate('chive-chart-filter-clear');
	actions.appendChild(selectAllBtn);
	actions.appendChild(clearSelectionBtn);
	body.appendChild(actions);

	const list = document.createElement('div');
	list.className = 'gf-list';
	body.appendChild(list);

	const summary = document.createElement('div');
	summary.className = 'gf-summary';
	body.appendChild(summary);

	const renderList = () => {
		const query = String(searchInput.value || '').trim();
		const options = getCategoricalFilterOptions(rows, rule.column, {
			search: query,
			limit: query.length > 0 ? Number.MAX_SAFE_INTEGER : FILTER_CATEGORY_LIMIT,
			missingLabel: translate('chive-chart-filter-missing'),
		});

		const includeSet = new Set(rule.include || []);
		list.innerHTML = '';
		options.options.forEach(item => {
			const row = document.createElement('label');
			row.className = 'gf-list-item';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.dataset.token = item.token;
			checkbox.checked = includeSet.has(item.token);
			checkbox.addEventListener('change', () => {
				const currentSet = new Set(rule.include || []);
				if (checkbox.checked) currentSet.add(item.token);
				else currentSet.delete(item.token);
				rule.include = Array.from(currentSet);
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
		rule.search = searchInput.value;
		renderList();
	});

	selectAllBtn.addEventListener('click', () => {
		const options = getCategoricalFilterOptions(rows, rule.column, {
			search: '',
			limit: Number.MAX_SAFE_INTEGER,
			missingLabel: translate('chive-chart-filter-missing'),
		});
		rule.include = options.allTokens.slice();
		renderList();
	});

	clearSelectionBtn.addEventListener('click', () => {
		rule.include = [];
		renderList();
	});

	renderList();
}

function renderRuleBody({ body, rule, rows, numericColumns, translate }) {
	if (!rule.column) {
		body.innerHTML = '';
		const empty = document.createElement('div');
		empty.className = 'gf-empty';
		empty.textContent = translate('chive-global-filter-empty');
		body.appendChild(empty);
		return;
	}

	if (numericColumns.includes(rule.column)) {
		rule.mode = 'numeric';
		renderNumericRuleBody({ body, rule, translate });
	} else {
		rule.mode = 'categorical';
		renderCategoricalRuleBody({ body, rule, rows, translate });
	}
}

function renderRuleCard({ rule, index, rows, allColumns, numericColumns, translate, onRemove }) {
	const card = document.createElement('div');
	card.className = 'gf-rule-card';
	card.dataset.ruleUid = String(rule._uid);

	const header = document.createElement('div');
	header.className = 'gf-rule-header';

	const title = document.createElement('span');
	title.className = 'gf-rule-title';
	title.textContent = translate('chive-global-filter-rule-title', index + 1);
	header.appendChild(title);

	const removeBtn = document.createElement('button');
	removeBtn.type = 'button';
	removeBtn.className = 'btn-secundario gf-rule-remove';
	removeBtn.textContent = translate('chive-global-filter-remove-rule');
	removeBtn.addEventListener('click', () => onRemove(rule._uid));
	header.appendChild(removeBtn);

	card.appendChild(header);

	const columnWrap = document.createElement('div');
	columnWrap.className = 'gf-control';
	const columnLabel = document.createElement('label');
	columnLabel.textContent = translate('chive-chart-filter-column');
	const columnSelect = document.createElement('select');
	columnSelect.className = 'linhas-select gf-rule-column';
	columnSelect.appendChild(createOption('', translate('chive-chart-option-none'), !rule.column));
	allColumns.forEach(name => columnSelect.appendChild(createOption(name, name, rule.column === name)));
	columnWrap.appendChild(columnLabel);
	columnWrap.appendChild(columnSelect);
	card.appendChild(columnWrap);

	const body = document.createElement('div');
	body.className = 'gf-rule-body';
	card.appendChild(body);

	renderRuleBody({ body, rule, rows, numericColumns, translate });

	columnSelect.addEventListener('change', () => {
		const nextColumn = columnSelect.value || null;
		if (!nextColumn) {
			rule.column = null;
			rule.include = [];
			rule.exclude = [];
			rule.search = '';
			renderRuleBody({ body, rule, rows, numericColumns, translate });
			return;
		}
		rule.column = nextColumn;
		if (numericColumns.includes(nextColumn)) {
			rule.mode = 'numeric';
			rule.operator = 'between';
			rule.min = '';
			rule.max = '';
			rule.value = '';
			rule.exclude = [];
		} else {
			rule.mode = 'categorical';
			const options = getCategoricalFilterOptions(rows, nextColumn, {
				search: '',
				limit: Number.MAX_SAFE_INTEGER,
				missingLabel: translate('chive-chart-filter-missing'),
			});
			rule.include = options.allTokens.slice();
			rule.exclude = [];
			rule.search = '';
		}
		renderRuleBody({ body, rule, rows, numericColumns, translate });
	});

	return card;
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

		const hint = document.createElement('p');
		hint.className = 'gf-hint';
		hint.textContent = translate('chive-global-filter-combine-hint');
		dialog.appendChild(hint);

		// Normalize initial filter into a rules array with safe column references.
		const initialNormalized = normalizeGlobalFilter(initialFilter, numericColumns);
		const safeInitialRules = initialNormalized.rules.filter(rule => allColumns.includes(rule.column));
		const draftRules = safeInitialRules.map(rule => ruleFromExisting(rule));

		const rulesContainer = document.createElement('div');
		rulesContainer.className = 'gf-rules-container';
		dialog.appendChild(rulesContainer);

		const emptyState = document.createElement('div');
		emptyState.className = 'gf-empty';
		emptyState.textContent = translate('chive-global-filter-no-rules');

		const topActions = document.createElement('div');
		topActions.className = 'gf-top-actions';

		const addRuleBtn = document.createElement('button');
		addRuleBtn.type = 'button';
		addRuleBtn.className = 'btn-secundario gf-add-rule';
		addRuleBtn.textContent = translate('chive-global-filter-add-rule');
		topActions.appendChild(addRuleBtn);

		const clearAllBtn = document.createElement('button');
		clearAllBtn.type = 'button';
		clearAllBtn.className = 'btn-secundario gf-clear-all';
		clearAllBtn.textContent = translate('chive-global-filter-clear-all');
		topActions.appendChild(clearAllBtn);

		dialog.appendChild(topActions);

		const footer = document.createElement('div');
		footer.className = 'join-footer gf-footer';
		const cancelBtn = document.createElement('button');
		cancelBtn.type = 'button';
		cancelBtn.className = 'btn-secundario gf-cancel';
		cancelBtn.textContent = translate('chive-global-filter-cancel');
		const applyBtn = document.createElement('button');
		applyBtn.type = 'button';
		applyBtn.className = 'btn-primario gf-apply';
		applyBtn.textContent = translate('chive-global-filter-apply');
		footer.appendChild(cancelBtn);
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

		const finalizeRules = () => {
			return draftRules
				.filter(rule => rule.column && allColumns.includes(rule.column))
				.map(rule => stripUid(rule));
		};

		const renderRules = () => {
			rulesContainer.innerHTML = '';
			if (draftRules.length === 0) {
				rulesContainer.appendChild(emptyState);
				return;
			}
			if (emptyState.parentElement) emptyState.remove();
			draftRules.forEach((rule, index) => {
				const card = renderRuleCard({
					rule,
					index,
					rows,
					allColumns,
					numericColumns,
					translate,
					onRemove: uid => {
						const idx = draftRules.findIndex(r => r._uid === uid);
						if (idx >= 0) {
							draftRules.splice(idx, 1);
							renderRules();
						}
					},
				});
				rulesContainer.appendChild(card);
			});
		};

		addRuleBtn.addEventListener('click', () => {
			draftRules.push(createEmptyRuleDraft());
			renderRules();
		});

		clearAllBtn.addEventListener('click', () => {
			draftRules.splice(0, draftRules.length);
			renderRules();
			const cleared = createEmptyGlobalFilter();
			if (typeof onClear === 'function') onClear(cleared);
			closeDialog('clear', cleared);
		});

		cancelBtn.addEventListener('click', () => closeDialog('cancel', null));

		applyBtn.addEventListener('click', () => {
			const applied = { rules: finalizeRules(), combine: 'AND' };
			if (typeof onApply === 'function') onApply(applied);
			closeDialog('apply', applied);
		});

		overlay.addEventListener('click', event => {
			if (event.target === overlay) closeDialog('cancel', null);
		});

		document.addEventListener('keydown', onEscape);

		renderRules();
	});
}
