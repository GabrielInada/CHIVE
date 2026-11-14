/**
 * CHIVE panel slot lifecycle.
 *
 * Manages the mount/unmount lifecycle for chart slots inside the panel.
 * Each slot tracks visibility, a `ResizeObserver` (for responsive re-render), an
 * in-flight `requestAnimationFrame` token (debounce), any D3 force
 * simulation attached by `network` charts, and any dispose hook a canvas
 * renderer stashed on the container (run via `clearChartContainer`). The
 * lifecycle here ensures none of those leak across re-renders.
 *
 * Storage is via a module-private `WeakMap` keyed by container element so
 * removing the container from the DOM also frees the entry.
 */

import { renderChartSnapshot } from './renderChartSnapshot.js';
import { hideChartTooltip } from '../../../charts/shared/tooltip/tooltip.js';
import { clearChartContainer } from '../../../charts/shared/containerLifecycle.js';

const SIMULATION_KEY = '__chive_network_simulation__';
const slotState = new WeakMap();

function readSize(container) {
	return {
		width: container.clientWidth,
		// Thumbnails use the snapshot height; their own height is not a render input.
		height: container.classList.contains('panel-chart-container') ? container.clientHeight : 0,
	};
}

function hasSizeChanged(container, entry) {
	const size = readSize(container);
	return !entry.size || size.width !== entry.size.width || size.height !== entry.size.height;
}

function hasLayoutSize(container) {
	return container.clientWidth > 0 && (!container.classList.contains('panel-chart-container') || container.clientHeight > 0);
}

function cancelFrame(entry) {
	if (entry.frame !== null) scheduler.cancel(entry.frame);
	entry.frame = null;
}

function renderSlot(container, entry) {
	cancelFrame(entry);
	if (!hasSizeChanged(container, entry)) return;
	stopNetworkSimulation(container);
	clearChartContainer(container);
	const result = renderChartSnapshot(container, entry.snapshot);
	entry.size = readSize(container);
	return result;
}

function scheduleRender(container, entry) {
	if (!entry.visible || entry.frame !== null || !hasSizeChanged(container, entry)) return;
	// A hidden tab/sidebar must not replace a valid render with fallback dimensions.
	if (!hasLayoutSize(container)) return;
	entry.frame = scheduler.schedule(() => {
		entry.frame = null;
		if (slotState.get(container) === entry && entry.visible && hasLayoutSize(container)) renderSlot(container, entry);
	});
}

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
 * Mount a chart snapshot into `container`. Tears down any prior mount first,
 * delegates to {@link renderChartSnapshot} when visible, and re-renders only
 * when rendering dimensions change. Deferred slots retain their CSS layout
 * space and warm up shortly before entering the viewport. Browsers without
 * IntersectionObserver render eagerly. Expanded charts also render eagerly.
 *
 * @param {HTMLElement} container
 * @param {import('../../../types.js').ChartSnapshot} snapshot
 * @param {{ deferUntilVisible?: boolean }} [options]
 * @returns {import('../../../types.js').Result | undefined} Immediate render result, or undefined for a deferred/missing slot.
 */
export function mountSlot(container, snapshot, { deferUntilVisible = false } = {}) {
	if (!container || !snapshot) return;
	teardownSlot(container);

	const deferred = deferUntilVisible && typeof window.IntersectionObserver === 'function';
	const entry = { snapshot, observer: null, visibilityObserver: null, visible: !deferred, frame: null, size: null };
	slotState.set(container, entry);
	const result = deferred ? undefined : renderSlot(container, entry);

	if (deferred) {
		entry.visibilityObserver = new window.IntersectionObserver(entries => {
			if (slotState.get(container) !== entry || entries.length === 0) return;
			entry.visible = entries[entries.length - 1].isIntersecting;
			if (entry.visible) scheduleRender(container, entry);
			else cancelFrame(entry);
		}, { rootMargin: '200px 0px' });
		entry.visibilityObserver.observe(container);
	}

	if (typeof ResizeObserver === 'function') {
		const observer = new ResizeObserver(() => {
			const current = slotState.get(container);
			if (current === entry) scheduleRender(container, entry);
		});
		observer.observe(container);
		entry.observer = observer;
	}
	return result;
}

/**
 * Materialize every chart for an explicit whole-dashboard SVG export, including
 * slots that have not been scrolled into view and offscreen slots awaiting resize.
 * This changes presentation only; captured data and saved layout stay intact.
 * @param {Element} rootEl
 */
export function renderAllSlots(rootEl) {
	rootEl.querySelectorAll('.panel-chart-container').forEach(container => {
		const entry = slotState.get(container);
		if (entry) renderSlot(container, entry);
	});
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
		if (entry.visibilityObserver) entry.visibilityObserver.disconnect();
		cancelFrame(entry);
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
	const slots = rootEl.querySelectorAll('.panel-chart-container, .panel-item-preview');
	slots.forEach(teardownSlot);
}
