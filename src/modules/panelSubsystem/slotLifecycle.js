/**
 * CHIVE panel slot lifecycle.
 *
 * Manages the mount/unmount lifecycle for chart slots inside the panel.
 * Each slot tracks a `ResizeObserver` (for responsive re-render), an
 * in-flight `requestAnimationFrame` token (debounce), any D3 force
 * simulation attached by `network` charts, and any dispose hook a canvas
 * renderer stashed on the container (run via `clearChartContainer`). The
 * lifecycle here ensures none of those leak across re-renders.
 *
 * Storage is via a module-private `WeakMap` keyed by container element so
 * removing the container from the DOM also frees the entry.
 */

import { renderChartFromSpec } from './renderChartFromSpec.js';
import { hideChartTooltip } from '../visualizations/tooltip.js';
import { clearChartContainer } from '../../utils/chartContainerLifecycle.js';

const SIMULATION_KEY = '__chive_network_simulation__';
const slotState = new WeakMap();

/**
 * Pick the best scheduler available. In a browser context we use RAF; in
 * jsdom or a node test env, fall back to `setTimeout(16)`.
 *
 * @private
 * @returns {{ schedule: (cb: () => void) => number, cancel: (id: number) => void }}
 */
function rafScheduler() {
	if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
		return {
			schedule: cb => window.requestAnimationFrame(cb),
			cancel: id => window.cancelAnimationFrame(id),
		};
	}
	return {
		schedule: cb => setTimeout(cb, 16),
		cancel: id => clearTimeout(id),
	};
}

const scheduler = rafScheduler();

/**
 * Stop and clear any D3 force simulation stashed on the container by a
 * network chart. The chart code stashes `simulation` on
 * `container[SIMULATION_KEY]` precisely so it can be torn down here.
 *
 * @private
 */
function stopNetworkSimulation(container) {
	if (!container) return;
	const simulation = container[SIMULATION_KEY];
	if (simulation && typeof simulation.stop === 'function') {
		simulation.stop();
	}
	container[SIMULATION_KEY] = null;
}

/**
 * Mount a chart spec into `container`. Tears down any prior mount first,
 * delegates the actual render to {@link renderChartFromSpec}, then
 * attaches a `ResizeObserver` that re-renders on container resize
 * (debounced via RAF).
 *
 * @param {HTMLElement} container
 * @param {import('../../types.js').ChartSnapshot} spec
 * @returns {import('../../types.js').Result | undefined} The render result; `undefined` when inputs are missing.
 */
export function mountSlot(container, spec) {
	if (!container || !spec) return;
	teardownSlot(container);

	const result = renderChartFromSpec(container, spec);

	const entry = { spec, observer: null, frame: null };
	if (typeof ResizeObserver === 'function') {
		const observer = new ResizeObserver(() => {
			const current = slotState.get(container);
			if (!current) return;
			if (current.frame !== null) {
				scheduler.cancel(current.frame);
			}
			current.frame = scheduler.schedule(() => {
				current.frame = null;
				stopNetworkSimulation(container);
				// Dispose-aware clear: a canvas chart's stashed dispose hook must
				// run before the replacement render creates a fresh context.
				clearChartContainer(container);
				renderChartFromSpec(container, current.spec);
			});
		});
		observer.observe(container);
		entry.observer = observer;
	}
	slotState.set(container, entry);

	return result;
}

/**
 * Tear down a single slot: disconnect the ResizeObserver, cancel any
 * pending RAF, stop the network simulation if any, and clear the
 * container's children. Safe to call on a container that was never
 * mounted.
 *
 * @param {HTMLElement | null | undefined} container
 */
export function teardownSlot(container) {
	if (!container) return;
	const entry = slotState.get(container);
	if (entry) {
		if (entry.observer) entry.observer.disconnect();
		if (entry.frame !== null) scheduler.cancel(entry.frame);
		slotState.delete(container);
	}
	stopNetworkSimulation(container);
	// Clear any active/pinned tooltip so a teardown mid-pin does not orphan the
	// document-level keydown/mousedown listeners attachPinnedListeners registers.
	hideChartTooltip();
	// Dispose-aware clear: runs a canvas chart's stashed dispose hook, then
	// empties the container. SVG charts never set the hook.
	clearChartContainer(container);
}

/**
 * Tear down every slot inside `rootEl`. Used by the panel renderer
 * before replacing children to make sure the previous mount cycle's
 * resources are released.
 *
 * @param {Element | null | undefined} rootEl
 */
export function teardownAllSlots(rootEl) {
	if (!rootEl) return;
	const slots = rootEl.querySelectorAll('.panel-slot-svg, .panel-item-preview');
	slots.forEach(teardownSlot);
}
