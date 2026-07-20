/**
 * Join-builder dialog. Two dataset selects + composite-key pickers + per-
 * side column checklists + join type. Resolves with a join-spec
 * `{ leftIndex, rightIndex, joinType, leftKeys, rightKeys, leftColumns,
 * rightColumns }` or `null` on cancel.
 *
 * Internal helpers are unexported; the entry point is
 * {@link openJoinBuilderDialog}.
 */

import { isNullish } from '../../../utils/formatters.js';
import { showError } from '../../../ui/feedback.js';
import { showNativeModal } from '../../../ui/nativeDialog.js';
import { joinValidationMessageKey, validateJoinSpec } from '../joinValidation.js';

/** @private */
function createOption(value, label, selected = false) {
	const option = document.createElement('option');
	option.value = String(value);
	option.textContent = label;
	option.selected = selected;
	return option;
}

/** @private */
function createCheckboxList(listId, items, selectedValues, title) {
	const wrapper = document.createElement('div');
	wrapper.className = 'join-list-wrapper';

	const heading = document.createElement('div');
	heading.className = 'join-list-title';
	heading.textContent = title;
	wrapper.appendChild(heading);

	const list = document.createElement('div');
	list.className = 'join-list';
	list.id = listId;

	items.forEach(item => {
		const row = document.createElement('label');
		row.className = 'join-list-item';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = item;
		checkbox.checked = selectedValues.has(item);

		const text = document.createElement('span');
		text.textContent = item;

		row.appendChild(checkbox);
		row.appendChild(text);
		list.appendChild(row);
	});

	wrapper.appendChild(list);
	return wrapper;
}

/** @private */
function getCheckedValues(container, selector) {
	return Array.from(container.querySelectorAll(selector))
		.filter(input => input.checked)
		.map(input => input.value);
}

/** @private */
function normalizeJoinKey(value) {
	if (isNullish(value)) return '';
	return String(value).trim().toLowerCase();
}

/** @private */
function buildJoinKey(row, keyColumns) {
	return keyColumns.map(key => normalizeJoinKey(row?.[key])).join('\u0001');
}

/**
 * Estimate the resulting row count for the current join spec without
 * actually performing the join. Used to keep the dialog's preview counter
 * accurate as the user tweaks keys/type.
 *
 * @private
 */
function estimateJoinRowCount({ leftRows, rightRows, leftKeys, rightKeys, joinType }) {
	if (!Array.isArray(leftRows) || !Array.isArray(rightRows)) return 0;
	if (!Array.isArray(leftKeys) || !Array.isArray(rightKeys)) return 0;
	if (leftKeys.length === 0 || rightKeys.length === 0) return 0;
	if (leftKeys.length !== rightKeys.length) return 0;

	const normalizedJoinType = ['inner', 'left', 'right', 'full'].includes(joinType) ? joinType : 'inner';
	const rightIndex = new Map();
	rightRows.forEach((row, index) => {
		const key = buildJoinKey(row, rightKeys);
		const bucket = rightIndex.get(key) || [];
		bucket.push(index);
		rightIndex.set(key, bucket);
	});

	let total = 0;
	const matchedRight = new Set();

	leftRows.forEach(leftRow => {
		const key = buildJoinKey(leftRow, leftKeys);
		const matches = rightIndex.get(key) || [];
		if (matches.length > 0) {
			total += matches.length;
			matches.forEach(index => matchedRight.add(index));
			return;
		}

		if (normalizedJoinType === 'left' || normalizedJoinType === 'full') {
			total += 1;
		}
	});

	if (normalizedJoinType === 'right' || normalizedJoinType === 'full') {
		total += (rightRows.length - matchedRight.size);
	}

	return total;
}

/** @private */
function renderDatasetColumnPickers({
	container,
	prefix,
	dataset,
	translate,
	isLeft,
	defaultKey,
}) {
	container.replaceChildren();

	if (!dataset) return;

	const columnNames = dataset.columns.map(column => column.name);
	const keySelection = new Set(defaultKey ? [defaultKey] : []);
	const allColumns = new Set(columnNames);

	const keysLabel = isLeft
		? translate('chive-join-left-keys')
		: translate('chive-join-right-keys');
	const columnsLabel = isLeft
		? translate('chive-join-left-columns')
		: translate('chive-join-right-columns');

	container.appendChild(
		createCheckboxList(`${prefix}-keys`, columnNames, keySelection, keysLabel)
	);
	container.appendChild(
		createCheckboxList(`${prefix}-columns`, columnNames, allColumns, columnsLabel)
	);
}

/**
 * Open the join-builder dialog. Resolves with a join spec or `null` on
 * cancel.
 *
 * Spec shape:
 *   `{ leftIndex, rightIndex, joinType, leftKeys, rightKeys, leftColumns,
 *      rightColumns, normalization: { trim, caseSensitive } }`
 *
 * Disabled when fewer than 2 datasets exist (the trigger button enforces
 * this; the dialog assumes `datasets.length >= 2` on open).
 *
 * @param {{ datasets: Array<{ name: string, rows: Array<*>, columns: Array<{ name: string }> }>, translate: (key: string, ...args: *) => string }} args
 * @returns {Promise<Object | null>}
 */
export function openJoinBuilderDialog({ datasets, translate }) {
	if (!Array.isArray(datasets) || datasets.length < 2) {
		showError(translate('chive-join-error-min-files'));
		return Promise.resolve(null);
	}

	return new Promise(resolve => {
		const dialog = document.createElement('dialog');
		dialog.className = 'app-dialog';
		dialog.setAttribute('aria-labelledby', 'join-dialog-title');

		const surface = document.createElement('form');
		surface.method = 'dialog';
		surface.className = 'join-dialog';
		surface.noValidate = true;

		const title = document.createElement('h3');
		title.className = 'join-title';
		title.id = 'join-dialog-title';
		title.textContent = translate('chive-join-dialog-title');
		surface.appendChild(title);

		const controls = document.createElement('div');
		controls.className = 'join-controls';

		const leftGroup = document.createElement('div');
		leftGroup.className = 'join-control';
		const leftLabel = document.createElement('label');
		leftLabel.textContent = translate('chive-join-left-file');
		leftLabel.htmlFor = 'join-left-file';
		const leftSelect = document.createElement('select');
		leftSelect.id = 'join-left-file';
		leftSelect.className = 'rows-select';
		datasets.forEach((dataset, index) => {
			leftSelect.appendChild(createOption(index, dataset.name, index === 0));
		});
		leftGroup.appendChild(leftLabel);
		leftGroup.appendChild(leftSelect);

		const rightGroup = document.createElement('div');
		rightGroup.className = 'join-control';
		const rightLabel = document.createElement('label');
		rightLabel.textContent = translate('chive-join-right-file');
		rightLabel.htmlFor = 'join-right-file';
		const rightSelect = document.createElement('select');
		rightSelect.id = 'join-right-file';
		rightSelect.className = 'rows-select';
		datasets.forEach((dataset, index) => {
			rightSelect.appendChild(createOption(index, dataset.name, index === 1));
		});
		rightGroup.appendChild(rightLabel);
		rightGroup.appendChild(rightSelect);

		const typeGroup = document.createElement('div');
		typeGroup.className = 'join-control';
		const typeLabel = document.createElement('label');
		typeLabel.textContent = translate('chive-join-type');
		typeLabel.htmlFor = 'join-type';
		const typeSelect = document.createElement('select');
		typeSelect.id = 'join-type';
		typeSelect.className = 'rows-select';
		[
			{ value: 'inner', label: translate('chive-join-type-inner') },
			{ value: 'left', label: translate('chive-join-type-left') },
			{ value: 'right', label: translate('chive-join-type-right') },
			{ value: 'full', label: translate('chive-join-type-full') },
		].forEach(item => typeSelect.appendChild(createOption(item.value, item.label, item.value === 'inner')));
		typeGroup.appendChild(typeLabel);
		typeGroup.appendChild(typeSelect);

		controls.appendChild(leftGroup);
		controls.appendChild(rightGroup);
		controls.appendChild(typeGroup);
		surface.appendChild(controls);

		const columnsGrid = document.createElement('div');
		columnsGrid.className = 'join-columns-grid';
		const leftColumnsContainer = document.createElement('div');
		leftColumnsContainer.className = 'join-column-panel';
		const rightColumnsContainer = document.createElement('div');
		rightColumnsContainer.className = 'join-column-panel';
		columnsGrid.appendChild(leftColumnsContainer);
		columnsGrid.appendChild(rightColumnsContainer);
		surface.appendChild(columnsGrid);

		const estimate = document.createElement('div');
		estimate.className = 'join-estimate';
		surface.appendChild(estimate);

		const validationError = document.createElement('p');
		validationError.id = 'join-validation-error';
		validationError.className = 'join-validation-error';
		validationError.setAttribute('role', 'alert');
		validationError.hidden = true;
		surface.appendChild(validationError);

		const footer = document.createElement('div');
		footer.className = 'join-footer';
		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.className = 'btn-secondary';
		cancelButton.textContent = translate('chive-join-cancel');
		const createButton = document.createElement('button');
		createButton.type = 'button';
		createButton.className = 'btn-primary';
		createButton.textContent = translate('chive-join-create');
		footer.appendChild(cancelButton);
		footer.appendChild(createButton);
		surface.appendChild(footer);
		dialog.appendChild(surface);

		let settled = false;
		const closeDialog = result => {
			if (settled) return;
			settled = true;
			lifecycle.close(result ? 'create' : 'cancel');
			resolve(result);
		};

		const clearValidation = () => {
			validationError.hidden = true;
			validationError.textContent = '';
			[rightSelect, leftColumnsContainer, rightColumnsContainer].forEach(element => {
				element.removeAttribute('aria-invalid');
				element.removeAttribute('aria-describedby');
			});
			rightSelect.setCustomValidity('');
		};

		const showValidation = reason => {
			const message = translate(joinValidationMessageKey(reason));
			validationError.textContent = message;
			validationError.hidden = false;

			let focusTarget = rightSelect;
			if (reason === 'keys-required' || reason === 'key-count-mismatch') {
				leftColumnsContainer.setAttribute('aria-invalid', 'true');
				rightColumnsContainer.setAttribute('aria-invalid', 'true');
				leftColumnsContainer.setAttribute('aria-describedby', validationError.id);
				rightColumnsContainer.setAttribute('aria-describedby', validationError.id);
				focusTarget = leftColumnsContainer.querySelector('#join-left-keys input') || rightSelect;
			} else if (reason === 'columns-required') {
				leftColumnsContainer.setAttribute('aria-invalid', 'true');
				rightColumnsContainer.setAttribute('aria-invalid', 'true');
				leftColumnsContainer.setAttribute('aria-describedby', validationError.id);
				rightColumnsContainer.setAttribute('aria-describedby', validationError.id);
				focusTarget = leftColumnsContainer.querySelector('#join-left-columns input') || rightSelect;
			} else {
				rightSelect.setAttribute('aria-invalid', 'true');
				rightSelect.setAttribute('aria-describedby', validationError.id);
				rightSelect.setCustomValidity(message);
			}
			focusTarget.focus({ preventScroll: true });
		};

		const refreshColumnPanels = () => {
			clearValidation();
			const leftDataset = datasets[Number(leftSelect.value)];
			const rightDataset = datasets[Number(rightSelect.value)];
			const leftDefaultKey = leftDataset?.columns?.[0]?.name || null;
			const rightDefaultKey = rightDataset?.columns?.[0]?.name || null;
			renderDatasetColumnPickers({
				container: leftColumnsContainer,
				prefix: 'join-left',
				dataset: leftDataset,
				translate,
				isLeft: true,
				defaultKey: leftDefaultKey,
			});
			renderDatasetColumnPickers({
				container: rightColumnsContainer,
				prefix: 'join-right',
				dataset: rightDataset,
				translate,
				isLeft: false,
				defaultKey: rightDefaultKey,
			});
			refreshEstimate();
		};

		const refreshEstimate = () => {
			const leftDataset = datasets[Number(leftSelect.value)];
			const rightDataset = datasets[Number(rightSelect.value)];
			if (!leftDataset || !rightDataset) {
				estimate.textContent = translate('chive-join-estimate-empty');
				return;
			}

			const leftKeys = getCheckedValues(leftColumnsContainer, '#join-left-keys input[type="checkbox"]');
			const rightKeys = getCheckedValues(rightColumnsContainer, '#join-right-keys input[type="checkbox"]');
			if (leftKeys.length === 0 || rightKeys.length === 0 || leftKeys.length !== rightKeys.length) {
				estimate.textContent = translate('chive-join-estimate-empty');
				return;
			}

			const estimatedRows = estimateJoinRowCount({
				leftRows: leftDataset.rows,
				rightRows: rightDataset.rows,
				leftKeys,
				rightKeys,
				joinType: typeSelect.value,
			});
			estimate.textContent = translate('chive-join-estimate-rows', estimatedRows.toLocaleString());
		};

		leftSelect.addEventListener('change', refreshColumnPanels);
		rightSelect.addEventListener('change', refreshColumnPanels);
		typeSelect.addEventListener('change', () => {
			clearValidation();
			refreshEstimate();
		});
		leftColumnsContainer.addEventListener('change', () => {
			clearValidation();
			refreshEstimate();
		});
		rightColumnsContainer.addEventListener('change', () => {
			clearValidation();
			refreshEstimate();
		});
		cancelButton.addEventListener('click', () => closeDialog(null));

		createButton.addEventListener('click', () => {
			clearValidation();
			const spec = {
				leftIndex: Number(leftSelect.value),
				rightIndex: Number(rightSelect.value),
				joinType: typeSelect.value,
				leftKeys: getCheckedValues(leftColumnsContainer, '#join-left-keys input[type="checkbox"]'),
				rightKeys: getCheckedValues(rightColumnsContainer, '#join-right-keys input[type="checkbox"]'),
				leftColumns: getCheckedValues(leftColumnsContainer, '#join-left-columns input[type="checkbox"]'),
				rightColumns: getCheckedValues(rightColumnsContainer, '#join-right-columns input[type="checkbox"]'),
			};
			const validation = validateJoinSpec(datasets, spec);
			if (!validation.ok) {
				showValidation(validation.reason);
				return;
			}

			closeDialog({
				leftIndex: validation.leftIndex,
				rightIndex: validation.rightIndex,
				joinType: spec.joinType,
				leftKeys: validation.leftKeys,
				rightKeys: validation.rightKeys,
				leftColumns: validation.leftColumns,
				rightColumns: validation.rightColumns,
			});
		});

		refreshColumnPanels();
		const lifecycle = showNativeModal(dialog, {
			onDismiss: () => closeDialog(null),
		});
	});
}
