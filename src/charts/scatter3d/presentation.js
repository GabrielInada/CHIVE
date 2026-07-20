/**
 * Lazy 3D-scatter presentation flow.
 *
 * Three.js stays outside the application startup graph. Each container owns a
 * render token so late module completions cannot overwrite newer state.
 */

import { t } from '../../services/i18nService.js';
import { ok } from '../../utils/result.js';
import { clearChartContainer, showChartMessage } from '../shared/containerLifecycle.js';

const RENDER_TOKEN = '__chiveScatter3dRenderToken__';
let rendererModulePromise = null;

function loadRendererModule() {
	if (!rendererModulePromise) {
		rendererModulePromise = import('./renderers/three.js').catch(error => {
			rendererModulePromise = null;
			throw error;
		});
	}
	return rendererModulePromise;
}

/**
 * Invalidate a pending lazy render before a container is disabled or removed.
 *
 * @param {HTMLElement | null | undefined} container
 */
export function invalidateScatter3dRender(container) {
	if (container) container[RENDER_TOKEN] = Symbol('scatter3d-render-cancelled');
}

/**
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} config
 * @returns {import('../../types.js').Result}
 */
export function renderScatter3dInto(container, rows, config) {
	clearChartContainer(container);
	const token = Symbol('scatter3d-render');
	container[RENDER_TOKEN] = token;

	const pending = document.createElement('div');
	pending.className = 'chart-empty chart-loading';
	pending.textContent = t('chive-chart-scatter3d-loading');
	container.appendChild(pending);

	void loadRendererModule()
		.then(({ renderScatter3dChart }) => {
			if (container[RENDER_TOKEN] !== token || !container.isConnected) return;
			const result = renderScatter3dChart(container, rows, config.x, config.y, config.z, {
				customTitle: config.customTitle,
				chartHeight: config.chartHeight,
				pointSize: config.pointSize,
				opacity: config.opacity,
				color: config.color,
				labels: {
					controlsInstructions: t('chive-chart-scatter3d-controls-instructions'),
					contextLost: t('chive-chart-scatter3d-context-lost'),
					contextRestored: t('chive-chart-scatter3d-context-restored'),
				},
			});
			if (container[RENDER_TOKEN] !== token) return;
			applyResult(container, config, result);
		})
		.catch(() => {
			if (container[RENDER_TOKEN] !== token || !container.isConnected) return;
			showChartMessage(container, t('chive-chart-empty-scatter3d'));
		});

	return ok({ pending: true });
}

/**
 * @param {HTMLElement} container
 * @param {Object} config
 * @param {import('../../types.js').Result} result
 */
function applyResult(container, config, result) {
	if (!result.ok) {
		showChartMessage(container, t(emptyStateKey(result.reason)));
		return;
	}

	const canvas = container.querySelector('.chart-canvas-3d');
	canvas?.setAttribute(
		'aria-label',
		t('chive-chart-scatter3d-aria-label', config.x, config.y, config.z, String(result.renderedCount)),
	);

	if (result.truncated) {
		const notice = document.createElement('div');
		notice.className = 'chart-sampling-notice';
		notice.textContent = t(
			'chive-chart-scatter3d-sampling-notice',
			String(result.renderedCount),
			String(result.validCount),
		);
		container.appendChild(notice);
	}
}

function emptyStateKey(reason) {
	if (reason === 'no-valid-points') return 'chive-chart-empty-scatter3d-no-valid-points';
	if (reason === 'webgl-unavailable') return 'chive-chart-empty-scatter3d-webgl-unavailable';
	return 'chive-chart-empty-scatter3d';
}
