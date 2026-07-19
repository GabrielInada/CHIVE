/**
 * 3D-scatter Three.js renderer.
 *
 * Renders the sampled point set as a rotatable WebGL point cloud inside a
 * wireframe unit cube. Data Z maps to the vertical axis (matching the TIN
 * chart's "Z is height" convention), data Y maps to scene depth.
 *
 * Contract with the rest of the app:
 * - Stateless and i18n-free: rows/columns/options in, `Result` out. All
 *   localized strings arrive via `options.labels`; the ok payload carries
 *   the sampling counts so the caller can render the localized notice.
 * - Dispose-first: entry calls `clearChartContainer`, which runs any
 *   previous mount's dispose hook, so re-renders never stack a second
 *   WebGL context on the same container (browsers cap live contexts).
 *   After a successful build the fresh disposer is stashed under
 *   `CHART_DISPOSE_HOOK`; only the lifecycle helper ever runs it.
 * - Render-on-demand: one `renderer.render` per input event, no
 *   persistent animation loop.
 */

import * as THREE from '../../../../vendor/three/three.module.js';
import { ok, fail } from '../../../utils/result.js';
import { clearChartContainer, CHART_DISPOSE_HOOK } from '../../shared/containerLifecycle.js';
import { CHART_DIMENSIONS } from '../../../config/charts/definitions.js';
import { SCATTER3D_CHART } from '../../../config/charts/definitions/scatter3d.js';
import { buildScatter3dPoints } from '../data.js';
import { normalizeScatter3dOptions } from '../options.js';
import { buildScatter3dScales } from '../scales.js';
import { attachScatter3dInteraction } from '../interaction.js';

// Uniqueness fallback for the aria-describedby id when the container has
// no id of its own (panel slots). Two live canvases must never share a
// description id.
let descriptionCounter = 0;

/**
 * Render the 3D scatter into `container`.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {string} x - Numeric column for the X axis.
 * @param {string} y - Numeric column for the Y axis (scene depth).
 * @param {string} z - Numeric column for the Z axis (height).
 * @param {Object} [options]
 * @param {number} [options.chartHeight]
 * @param {number} [options.pointSize]
 * @param {number} [options.opacity]
 * @param {string} [options.color]
 * @param {string} [options.customTitle]
 * @param {{ ariaLabel?: string, controlsInstructions?: string }} [options.labels]
 *   Pre-localized accessibility strings; the renderer never imports i18n.
 * @returns {import('../../../types.js').Result}
 *   `ok({ renderedCount, validCount, totalCount, truncated })`, or `fail`
 *   with `'no-valid-points'`, `'webgl-unavailable'`, `'render-error'`, or
 *   no reason for missing arguments.
 */
export function renderScatter3dChart(container, rows, x, y, z, options = {}) {
	if (!container || !x || !y || !z) return fail();

	clearChartContainer(container);

	const data = buildScatter3dPoints(rows, x, y, z);
	if (data.validCount === 0) return fail('no-valid-points');

	const opts = normalizeScatter3dOptions(options);
	const labels = options.labels || {};
	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.scatter3d.width, 320);
	const height = opts.chartHeight;

	let renderer;
	try {
		renderer = new THREE.WebGLRenderer({ antialias: true });
	} catch {
		return fail('webgl-unavailable');
	}

	// Undo list for the partial-build guard AND the final dispose hook.
	// Every GPU-holding object registers a disposer right after creation,
	// so an exception between context creation and hook stashing cannot
	// leak a context, geometry, material, or texture.
	const disposers = [];
	const disposeAll = () => {
		for (let i = disposers.length - 1; i >= 0; i--) {
			try {
				disposers[i]();
			} catch {
				// Disposal is best-effort; a failing disposer must not stop the rest.
			}
		}
		renderer.dispose();
		renderer.forceContextLoss?.();
	};

	try {
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SCATTER3D_CHART.maxDevicePixelRatio));
		renderer.setSize(width, height, false);

		const scene = new THREE.Scene();
		const scales = buildScatter3dScales(data.extents);

		const positions = new Float32Array(data.points.length * 3);
		for (let i = 0; i < data.points.length; i++) {
			const point = data.points[i];
			positions[i * 3] = scales.x(point.x);
			positions[i * 3 + 1] = scales.z(point.z);
			positions[i * 3 + 2] = scales.y(point.y);
		}

		const geometry = new THREE.BufferGeometry();
		disposers.push(() => geometry.dispose());
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const material = new THREE.PointsMaterial({
			color: new THREE.Color(opts.color),
			size: opts.pointSize,
			transparent: true,
			opacity: opts.opacity,
			sizeAttenuation: true,
		});
		disposers.push(() => material.dispose());
		scene.add(new THREE.Points(geometry, material));

		const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
		disposers.push(() => boxGeometry.dispose());
		const boxEdges = new THREE.EdgesGeometry(boxGeometry);
		disposers.push(() => boxEdges.dispose());
		const boxMaterial = new THREE.LineBasicMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.5 });
		disposers.push(() => boxMaterial.dispose());
		scene.add(new THREE.LineSegments(boxEdges, boxMaterial));

		addAxisLabel(scene, disposers, x, [1.35, -1, -1]);
		addAxisLabel(scene, disposers, y, [-1, -1, 1.35]);
		addAxisLabel(scene, disposers, z, [-1, 1.35, -1]);

		const camera = new THREE.PerspectiveCamera(SCATTER3D_CHART.camera.fov, width / height, 0.1, 100);
		const applyCamera = state => {
			const sinPhi = Math.sin(state.phi);
			camera.position.set(
				state.distance * sinPhi * Math.cos(state.theta),
				state.distance * Math.cos(state.phi),
				state.distance * sinPhi * Math.sin(state.theta),
			);
			camera.lookAt(0, 0, 0);
		};

		const canvas = renderer.domElement;
		canvas.className = 'chart-canvas-3d';
		canvas.setAttribute('tabindex', '0');
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Plus Minus Home');
		if (labels.ariaLabel) {
			canvas.setAttribute('aria-label', labels.ariaLabel);
		}

		const interaction = attachScatter3dInteraction(canvas, {
			constants: SCATTER3D_CHART.camera,
			onChange: state => {
				applyCamera(state);
				renderer.render(scene, camera);
			},
		});
		disposers.push(() => interaction.detach());

		if (opts.customTitle) {
			const title = document.createElement('div');
			title.className = 'chart-canvas-title';
			title.textContent = opts.customTitle;
			container.appendChild(title);
		}
		container.appendChild(canvas);
		if (labels.controlsInstructions) {
			const descriptionId = container.id
				? `${container.id}-controls-desc`
				: `chart-scatter3d-desc-${++descriptionCounter}`;
			const description = document.createElement('div');
			description.className = 'visually-hidden';
			description.id = descriptionId;
			description.textContent = labels.controlsInstructions;
			container.appendChild(description);
			canvas.setAttribute('aria-describedby', descriptionId);
		}

		applyCamera(interaction.state);
		renderer.render(scene, camera);

		container[CHART_DISPOSE_HOOK] = disposeAll;

		return ok({
			renderedCount: data.renderedCount,
			validCount: data.validCount,
			totalCount: data.totalCount,
			truncated: data.truncated,
		});
	} catch (error) {
		console.warn('scatter3d render failed mid-build:', error);
		disposeAll();
		return fail('render-error');
	}
}

/**
 * Add one axis-name label as a sprite with a canvas-2D texture. Skipped
 * (returns without adding) when a 2D context is unavailable, which keeps
 * jsdom and WebGL-less environments safe; the chart is still usable
 * without the labels.
 *
 * @private
 * @param {THREE.Scene} scene
 * @param {Array<() => void>} disposers
 * @param {string} text - Column name (user data, not i18n).
 * @param {[number, number, number]} position
 * @returns {void}
 */
function addAxisLabel(scene, disposers, text, position) {
	let context = null;
	const labelCanvas = document.createElement('canvas');
	try {
		context = labelCanvas.getContext('2d');
	} catch {
		context = null;
	}
	if (!context) return;

	labelCanvas.width = 256;
	labelCanvas.height = 64;
	context.font = '28px sans-serif';
	context.fillStyle = '#44403a';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(text, 128, 32);

	const texture = new THREE.CanvasTexture(labelCanvas);
	disposers.push(() => texture.dispose());
	const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
	disposers.push(() => material.dispose());
	const sprite = new THREE.Sprite(material);
	sprite.scale.set(1.1, 0.28, 1);
	sprite.position.set(position[0], position[1], position[2]);
	scene.add(sprite);
}
