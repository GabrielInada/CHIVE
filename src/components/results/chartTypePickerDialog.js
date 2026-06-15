/**
 * Chart-type picker dialog. A modal grid of cards (one per chart type)
 * that resolves with the chosen chart type, `null` for cancel, or
 * `{ chartType: null }` for the explicit "Clear" action.
 */

import { CHART_TYPES, PREVIEW_SVGS, CATEGORY_KEYS } from '../../modules/chartControls/chartTypes.js';
import { installDialogFocus } from '../../modules/dialogFocus.js';

/**
 * Build one chart-type card: preview SVG, name, category tag,
 * description. `isActive` styles the currently selected card.
 *
 * @private
 */
function buildChartCard(type, translate, isActive) {
	const card = document.createElement('button');
	card.type = 'button';
	card.className = `preset-card chart-picker-card${isActive ? ' selected' : ''}`;
	card.dataset.chartType = type;

	const preview = document.createElement('span');
	preview.className = 'chart-picker-card-preview';
	// innerHTML: static SVG markup from PREVIEW_SVGS; not user input.
	preview.innerHTML = PREVIEW_SVGS[type];
	card.appendChild(preview);

	const name = document.createElement('div');
	name.className = 'preset-card-name';
	name.textContent = translate(`chive-chart-toggle-${type}`);
	card.appendChild(name);

	const tag = document.createElement('div');
	tag.className = 'chart-picker-card-category';
	tag.textContent = translate(CATEGORY_KEYS[type]);
	card.appendChild(tag);

	const desc = document.createElement('div');
	desc.className = 'preset-card-desc';
	desc.textContent = translate(`chive-viz-${type}-desc`);
	card.appendChild(desc);

	return card;
}

/**
 * Open the chart-type picker dialog. Returns a Promise that resolves
 * with the user's choice:
 *
 *   - `{ chartType: 'bar' | 'scatter' | ... }`, a chart card was clicked.
 *   - `{ chartType: null }`, the "Clear" button was clicked.
 *   - `null`, cancel, Escape, or backdrop click.
 *
 * @param {Object} args
 * @param {string | null} [args.activeChartType=null] - Pre-selected card.
 * @param {(key: string) => string} args.translate
 * @returns {Promise<{ chartType: string | null } | null>}
 */
export function openChartTypePickerDialog({ activeChartType = null, translate }) {
	return new Promise(resolve => {
		const overlay = document.createElement('div');
		overlay.className = 'join-overlay';

		const dialog = document.createElement('div');
		dialog.className = 'join-dialog chart-picker-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');

		const title = document.createElement('h3');
		title.className = 'join-title';
		title.textContent = translate('chive-chart-picker-dialog-title');
		dialog.appendChild(title);

		const grid = document.createElement('div');
		grid.className = 'chart-picker-grid';
		dialog.appendChild(grid);

		const footer = document.createElement('div');
		footer.className = 'join-footer';

		const clearButton = document.createElement('button');
		clearButton.type = 'button';
		clearButton.className = 'btn-secondary';
		clearButton.textContent = translate('chive-chart-picker-clear');

		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.className = 'btn-secondary';
		cancelButton.textContent = translate('chive-chart-picker-cancel');

		footer.appendChild(clearButton);
		footer.appendChild(cancelButton);
		dialog.appendChild(footer);

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		const focusControl = installDialogFocus(overlay, dialog);

		const closeDialog = result => {
			document.removeEventListener('keydown', onEscape);
			focusControl.release();
			overlay.remove();
			focusControl.restoreFocus();
			resolve(result);
		};

		const onEscape = event => {
			if (event.key !== 'Escape') return;
			closeDialog(null);
		};

		CHART_TYPES.forEach(type => {
			const card = buildChartCard(type, translate, type === activeChartType);
			card.addEventListener('click', () => closeDialog({ chartType: type }));
			grid.appendChild(card);
		});

		clearButton.addEventListener('click', () => closeDialog({ chartType: null }));
		cancelButton.addEventListener('click', () => closeDialog(null));

		overlay.addEventListener('click', event => {
			if (event.target === overlay) closeDialog(null);
		});

		document.addEventListener('keydown', onEscape);
	});
}
