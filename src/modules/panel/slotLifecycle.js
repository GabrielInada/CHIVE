import { renderChartFromSpec } from './renderChartFromSpec.js';

const SIMULATION_KEY = '__chive_network_simulation__';
const slotState = new WeakMap();

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

function stopNetworkSimulation(container) {
	if (!container) return;
	const simulation = container[SIMULATION_KEY];
	if (simulation && typeof simulation.stop === 'function') {
		simulation.stop();
	}
	container[SIMULATION_KEY] = null;
}

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
				renderChartFromSpec(container, current.spec);
			});
		});
		observer.observe(container);
		entry.observer = observer;
	}
	slotState.set(container, entry);

	return result;
}

export function teardownSlot(container) {
	if (!container) return;
	const entry = slotState.get(container);
	if (entry) {
		if (entry.observer) entry.observer.disconnect();
		if (entry.frame !== null) scheduler.cancel(entry.frame);
		slotState.delete(container);
	}
	stopNetworkSimulation(container);
	container.innerHTML = '';
}

export function teardownAllSlots(rootEl) {
	if (!rootEl) return;
	const slots = rootEl.querySelectorAll('.painel-slot-svg, .panel-item-preview');
	slots.forEach(teardownSlot);
}
