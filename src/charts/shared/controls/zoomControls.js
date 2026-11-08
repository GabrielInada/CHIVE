/**
 * CHIVE zoom control descriptions.
 *
 * The reset-zoom button that the pie and the network graph share, as a custom
 * control description for `buildDescribedControls`. Each chart passes its own
 * ids, which the sidebar restores focus and scroll by.
 *
 * Shared leaf infrastructure: the label is a message key.
 *
 * @typedef {import('../../../types.js').ControlDescription} ControlDescription
 */

/**
 * The reset-zoom button. A click puts the zoom slider back to `zoomScale` and
 * commits that zoom.
 *
 * @param {Object} options
 * @param {string} options.id - The button's id.
 * @param {string} options.label - Message key of the button text.
 * @param {string} options.sliderId - The zoom slider, a slider described before the button.
 * @param {number} options.zoomScale - The zoom the button restores.
 * @returns {ControlDescription}
 */
export function resetZoomControl({ id, label, sliderId, zoomScale }) {
	return {
		widget: 'custom',
		id,
		key: 'zoomScale',
		build: ({ writer, translate, disabled, control }) => {
			const slider = control(sliderId).querySelector('input');

			const wrapper = document.createElement('div');
			wrapper.className = 'chart-controle';
			const button = document.createElement('button');
			button.type = 'button';
			button.id = id;
			button.className = 'chart-control-btn';
			button.textContent = translate(label);
			button.disabled = disabled;
			wrapper.appendChild(button);

			button.addEventListener('click', () => {
				slider.value = String(zoomScale);
				const output = slider.parentElement?.querySelector('output');
				if (output) output.textContent = slider.value;
				writer.commit({ zoomScale });
			});
			return wrapper;
		},
	};
}
