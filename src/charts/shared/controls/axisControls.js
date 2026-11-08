/**
 * CHIVE axis control descriptions.
 *
 * The numeric axis select that the 3D scatter and the TIN share, as a control
 * description for `buildDescribedControls`. Each chart passes its own ids,
 * which the sidebar restores focus and scroll by.
 *
 * Shared leaf infrastructure: the label is a message key.
 *
 * @typedef {import('../../../types.js').ControlDescription} ControlDescription
 */

/**
 * An axis select: "None" and the visible numeric columns.
 *
 * @param {Object} options
 * @param {string} options.id
 * @param {string} options.key - The axis setting, such as `x`.
 * @param {string} options.label - Message key of the label.
 * @returns {ControlDescription}
 */
export function numericAxisControl({ id, key, label }) {
	return {
		widget: 'select',
		id,
		key,
		label,
		columns: context => context.numeric,
		// Any falsy axis, not only an unset one, shows "None".
		value: config => config[key] || '',
		// A forged option cannot store a column that is not numeric.
		toValue: (value, { context }) => (context.numeric.includes(value) ? value : null),
	};
}
