/**
 * Bubble controls written by hand: the progressive nesting levels, which no
 * shared widget covers.
 *
 * The levels are the `build` of a `custom` description in `descriptions.js`.
 * Each filled level adds an empty select below it, up to the depth cap, and
 * clearing a level drops the deeper ones. The levels offer the visible
 * columns other than the category, and a write keeps only those, so a forged
 * option cannot store a column the user cannot see. Legacy `groupColumn` is
 * read as the first level through `resolveNestingColumnsFromConfig`.
 *
 * @typedef {import('../../../types.js').CustomControlScope} CustomControlScope
 */

import { BUBBLE_CHART } from '../../../config/charts/definitions/bubble.js';
import { normalizeColumnNameList } from '../../../domain/datasets/columns.js';
import { createSelectControl } from '../../shared/controls/factories.js';
import { computeNestingControlCount, resolveNestingColumnsFromConfig } from './nestingColumns.js';

/**
 * The nesting-level selects. Disabled, like every control, while the chart is
 * off, and while the chart is flat (the description's `disabledWhen`).
 *
 * @param {CustomControlScope} scope
 * @returns {HTMLElement[]}
 */
export function buildNestingLevels({ config, readConfig, context, writer, translate, disabled }) {
	const { allColumns } = context;
	const categoryColumn = config.category;
	// Normalize the columns first (drops '' / non-string / duplicates) so an empty
	// or junk column name cannot inflate allowed.size and spawn a useless trailing
	// selector; the category is excluded because it is never a valid nesting level.
	const allowed = new Set(
		normalizeColumnNameList(allColumns, { max: Infinity }).filter(name => name !== categoryColumn),
	);
	const nestingColumns = resolveNestingColumnsFromConfig(config, allowed);
	const levelCount = computeNestingControlCount(config, allowed);

	const levels = [];
	for (let levelIndex = 0; levelIndex < levelCount; levelIndex++) {
		// Exclude the columns other levels hold, and the category column.
		const excludedColumns = new Set(nestingColumns.filter((_, index) => index !== levelIndex));
		if (categoryColumn) excludedColumns.add(categoryColumn);

		const currentValue = nestingColumns[levelIndex] || '';
		const level = createSelectControl(
			`viz-select-bubble-nesting-level-${levelIndex}`,
			translate('chive-chart-control-bubble-nesting-level', levelIndex + 1),
			[
				{ value: '', label: translate('chive-chart-control-bubble-nesting-empty') },
				...allColumns.filter(column => !excludedColumns.has(column)).map(column => ({ value: column, label: column })),
			],
			currentValue,
			disabled,
		);
		const select = level.querySelector('select');
		select.addEventListener('change', () => {
			const updated = resolveNestingColumnsFromConfig(readConfig(), allowed).slice(0, levelIndex);
			const newValue = select.value || null;
			// Set this level; the slice already dropped the deeper ones.
			if (newValue) updated[levelIndex] = newValue;
			// Normalize at the write sink so even a forged option cannot persist an
			// out-of-allowlist or over-cap entry.
			const normalized = normalizeColumnNameList(updated, { allowed, max: BUBBLE_CHART.maxNestingDepth });
			writer.commit({
				nestingColumns: normalized,
				groupColumn: normalized[0] || null,
			});
		});
		levels.push(level);

		// An empty level is the last one shown.
		if (!currentValue) break;
	}
	return levels;
}
