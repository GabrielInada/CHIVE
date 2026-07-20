/**
 * 3D-scatter shared presentation flow.
 *
 * The workspace section and the panel adapter render the same chart from
 * different inputs (live config + filtered rows vs. a frozen snapshot).
 * This module owns their shared half: building the renderer options with
 * the localized labels, mapping fail reasons onto i18n empty-state keys,
 * and the post-render accessibility label and sampling notice (both need
 * the ok payload's counts, which only exist after the render).
 *
 * May import i18n; the renderer itself stays i18n-free.
 */

import { t } from '../../services/i18nService.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
import { renderScatter3dChart } from './renderers/three.js';

/**
 * Render the 3D scatter into `container` and apply the localized
 * post-render presentation.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} config - The `chartConfig.scatter3d` block (live or snapshot).
 * @returns {import('../../types.js').Result} The renderer result.
 */
export function renderScatter3dInto(container, rows, config) {
	const result = renderScatter3dChart(container, rows, config.x, config.y, config.z, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		pointSize: config.pointSize,
		opacity: config.opacity,
		color: config.color,
		labels: {
			controlsInstructions: t('chive-chart-scatter3d-controls-instructions'),
		},
	});

	if (!result.ok) {
		showChartMessage(container, t(emptyStateKey(result.reason)));
		return result;
	}

	// The aria label wants the RENDERED point count, which only the ok
	// payload knows (sampling may have reduced it), so it is set here
	// rather than passed in up front.
	const canvas = container.querySelector('.chart-canvas-3d');
	canvas?.setAttribute(
		'aria-label',
		t('chive-chart-scatter3d-aria-label', config.x, config.y, config.z, String(result.renderedCount)),
	);

	if (result.truncated) {
		const notice = document.createElement('div');
		notice.className = 'chart-sampling-notice';
		notice.textContent = t('chive-chart-scatter3d-sampling-notice', String(result.renderedCount), String(result.validCount));
		container.appendChild(notice);
	}

	return result;
}

/**
 * Map a renderer fail reason onto its i18n empty-state key.
 * `render-error` and bare failures share the generic key.
 *
 * @private
 * @param {string | undefined} reason
 * @returns {string}
 */
function emptyStateKey(reason) {
	if (reason === 'no-valid-points') return 'chive-chart-empty-scatter3d-no-valid-points';
	if (reason === 'webgl-unavailable') return 'chive-chart-empty-scatter3d-webgl-unavailable';
	return 'chive-chart-empty-scatter3d';
}
