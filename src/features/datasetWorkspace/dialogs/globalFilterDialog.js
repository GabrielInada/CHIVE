/**
 * Global-filter dialog DOM and lifecycle.
 *
 * Lets the user compose multiple AND-combined categorical or numeric rules.
 * Draft identity and transformations are delegated to globalFilterDraft.js.
 *
 * The dialog works on draft copies of the rules; commits return one of
 * three actions:
 *   - `{ action: 'apply', filter }`, Apply was clicked.
 *   - `{ action: 'clear', filter }`, Clear was clicked (filter is empty).
 *   - `{ action: 'cancel', filter: null }`, Cancel / Escape / backdrop click.
 */

import {
	FILTER_CATEGORY_LIMIT,
	getCategoricalFilterOptions,
} from '../../../domain/filters/chartFilter.js';
import { createEmptyGlobalFilter } from '../../../domain/filters/globalFilter.js';
import { toFiniteNumber } from '../../../utils/formatters.js';
import { showNativeModal } from '../../../ui/nativeDialog.js';
import {
	applyRuleColumnChange,
	createEmptyRuleDraft,
	createInitialDraftRules,
	finalizeGlobalFilterDraft,
} from './globalFilterDraft.js';

/** @private */
function createOption(value, label, selected = false) {
	const option = document.createElement('option');
	option.value = String(value);
	option.textContent = label;
	option.selected = selected;
	return option;
}

/**
 * Build the body of a numeric rule card: operator select + value
 * input(s). The "between" operator shows two inputs; everything else
 * shows one.
 *
 * @private
 */
function renderNumericRuleBody({ body, rule, rows, translate }) {
	body.replaceChildren();
	let domainMin = null;
	let domainMax = null;
	rows.forEach(row => {
		// Must match chartFilter's numeric coercion, or the dialog advertises a
		// domain bound that the filter itself excludes.
		const value = toFiniteNumber(row?.[rule.column]);
		if (!Number.isFinite(value)) return;
		domainMin = domainMin === null ? value : Math.min(domainMin, value);
		domainMax = domainMax === null ? value : Math.max(domainMax, value);
	});

	const configureInput = input => {
		input.step = 'any';
		if (domainMin !== null) input.min = String(domainMin);
		if (domainMax !== null) input.max = String(domainMax);
	};

	const opWrap = document.createElement('div');
	opWrap.className = 'gf-control';
	const opLabel = document.createElement('label');
	opLabel.textContent = translate('chive-chart-filter-operator');
	const opSelect = document.createElement('select');
	opSelect.className = 'rows-select gf-rule-operator';
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
		inputsWrap.replaceChildren();
		if (rule.operator === 'between') {
			const minWrap = document.createElement('div');
			minWrap.className = 'gf-control';
			const minLabel = document.createElement('label');
			minLabel.textContent = translate('chive-chart-filter-min');
			const minInput = document.createElement('input');
			minInput.type = 'number';
			minInput.className = 'rows-select';
			configureInput(minInput);
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
			maxInput.className = 'rows-select';
			configureInput(maxInput);
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
			valueInput.className = 'rows-select';
			configureInput(valueInput);
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

/**
 * Build the body of a categorical rule card: searchable include/exclude
 * chip lists with token suggestions sourced from the underlying rows.
 * Caps the unique-token list at `FILTER_CATEGORY_LIMIT` for performance.
 *
 * @private
 */
function renderCategoricalRuleBody({ body, rule, rows, translate }) {
	body.replaceChildren();

	const searchWrap = document.createElement('div');
	searchWrap.className = 'gf-control';
	const searchLabel = document.createElement('label');
	searchLabel.textContent = translate('chive-chart-filter-search');
	const searchInput = document.createElement('input');
	searchInput.type = 'search';
	searchInput.className = 'rows-select gf-rule-search';
	searchInput.value = rule.search || '';
	searchWrap.appendChild(searchLabel);
	searchWrap.appendChild(searchInput);
	body.appendChild(searchWrap);

	const actions = document.createElement('div');
	actions.className = 'gf-actions';
	const selectAllBtn = document.createElement('button');
	selectAllBtn.type = 'button';
	selectAllBtn.className = 'btn-secondary gf-action-btn gf-rule-select-all';
	selectAllBtn.textContent = translate('chive-chart-filter-select-all');
	const clearSelectionBtn = document.createElement('button');
	clearSelectionBtn.type = 'button';
	clearSelectionBtn.className = 'btn-secondary gf-action-btn gf-rule-clear-selection';
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
		list.replaceChildren();
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

/**
 * Dispatch to the numeric or categorical body builder based on the rule's
 * mode (auto-detected by whether the column is in `numericColumns`).
 *
 * @private
 */
function renderRuleBody({ body, rule, rows, numericColumns, translate }) {
	if (!rule.column) {
		body.replaceChildren();
		const empty = document.createElement('div');
		empty.className = 'gf-empty';
		empty.textContent = translate('chive-global-filter-empty');
		body.appendChild(empty);
		return;
	}

	if (numericColumns.includes(rule.column)) {
		rule.mode = 'numeric';
		renderNumericRuleBody({ body, rule, rows, translate });
	} else {
		rule.mode = 'categorical';
		renderCategoricalRuleBody({ body, rule, rows, translate });
	}
}

/**
 * Build one rule card: header (column select + remove button) + body
 * (numeric or categorical, swapped when the column changes type).
 *
 * @private
 */
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
	removeBtn.className = 'btn-secondary gf-rule-remove';
	removeBtn.textContent = translate('chive-global-filter-remove-rule');
	removeBtn.addEventListener('click', () => onRemove(rule._uid));
	header.appendChild(removeBtn);

	card.appendChild(header);

	const columnWrap = document.createElement('div');
	columnWrap.className = 'gf-control';
	const columnLabel = document.createElement('label');
	columnLabel.textContent = translate('chive-chart-filter-column');
	const columnSelect = document.createElement('select');
	columnSelect.className = 'rows-select gf-rule-column';
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
		applyRuleColumnChange(rule, nextColumn, {
			rows,
			numericColumns,
			missingLabel: translate('chive-chart-filter-missing'),
		});
		renderRuleBody({ body, rule, rows, numericColumns, translate });
	});

	return card;
}

/**
 * Open the global-filter dialog. Returns a Promise that resolves with
 * the user's action:
 *
 *   - `{ action: 'apply', filter }`, Apply was clicked. `filter` is the
 *     normalized `GlobalFilter` (possibly empty if all rules were
 *     deleted).
 *   - `{ action: 'clear', filter: GlobalFilter }`, Clear was clicked;
 *     `filter` is an empty filter.
 *   - `{ action: 'cancel', filter: null }`, Cancel / Escape / backdrop click.
 *
 * @param {Object} args
 * @param {Array<Object<string, *>>} args.rows
 * @param {string[]} args.allColumns
 * @param {string[]} args.numericColumns
 * @param {Object} args.initialFilter - Existing global filter; normalized on open.
 * @param {(key: string, ...args: *) => string} args.translate
 * @param {(filter: Object) => void} [args.onApply]
 * @param {(filter: Object) => void} [args.onClear]
 * @returns {Promise<{ action: 'apply' | 'clear' | 'cancel', filter: Object | null }>}
 */
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
		const dialog = document.createElement('dialog');
		dialog.className = 'app-dialog gf-overlay';
		dialog.setAttribute('aria-labelledby', 'global-filter-dialog-title');

		const surface = document.createElement('form');
		surface.method = 'dialog';
		surface.className = 'join-dialog gf-dialog';

		const title = document.createElement('h3');
		title.className = 'join-title';
		title.id = 'global-filter-dialog-title';
		title.textContent = translate('chive-global-filter-dialog-title');
		surface.appendChild(title);

		const hint = document.createElement('p');
		hint.className = 'gf-hint';
		hint.textContent = translate('chive-global-filter-combine-hint');
		surface.appendChild(hint);

		const draftRules = createInitialDraftRules(initialFilter, {
			numericColumns,
			allColumns,
		});

		const rulesContainer = document.createElement('div');
		rulesContainer.className = 'gf-rules-container';
		surface.appendChild(rulesContainer);

		const emptyState = document.createElement('div');
		emptyState.className = 'gf-empty';
		emptyState.textContent = translate('chive-global-filter-no-rules');

		const topActions = document.createElement('div');
		topActions.className = 'gf-top-actions';

		const addRuleBtn = document.createElement('button');
		addRuleBtn.type = 'button';
		addRuleBtn.className = 'btn-secondary gf-add-rule';
		addRuleBtn.textContent = translate('chive-global-filter-add-rule');
		topActions.appendChild(addRuleBtn);

		const clearAllBtn = document.createElement('button');
		clearAllBtn.type = 'button';
		clearAllBtn.className = 'btn-secondary gf-clear-all';
		clearAllBtn.textContent = translate('chive-global-filter-clear-all');
		topActions.appendChild(clearAllBtn);

		surface.appendChild(topActions);

		const footer = document.createElement('div');
		footer.className = 'join-footer gf-footer';
		const cancelBtn = document.createElement('button');
		cancelBtn.type = 'button';
		cancelBtn.className = 'btn-secondary gf-cancel';
		cancelBtn.textContent = translate('chive-global-filter-cancel');
		const applyBtn = document.createElement('button');
		applyBtn.type = 'button';
		applyBtn.className = 'btn-primary gf-apply';
		applyBtn.textContent = translate('chive-global-filter-apply');
		footer.appendChild(cancelBtn);
		footer.appendChild(applyBtn);
		surface.appendChild(footer);
		dialog.appendChild(surface);

		let settled = false;
		const closeDialog = (action, filterOut) => {
			if (settled) return;
			settled = true;
			lifecycle.close(action);
			resolve({ action, filter: filterOut });
		};

		const renderRules = () => {
			rulesContainer.replaceChildren();
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
			const applied = finalizeGlobalFilterDraft(draftRules, allColumns);
			if (typeof onApply === 'function') onApply(applied);
			closeDialog('apply', applied);
		});

		const lifecycle = showNativeModal(dialog, {
			onDismiss: () => closeDialog('cancel', null),
		});

		renderRules();
	});
}
