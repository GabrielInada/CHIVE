// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { createIsolineHoverHandlers } from '../../../src/charts/tin/interaction.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

const AXIS_LABELS = { x: 'X', y: 'Y', z: 'Elev' };

// Captures the handlers a d3 `.on(type, fn)` chain would register.
function makeStubGroup() {
	const handlers = {};
	const group = {
		on(type, fn) {
			handlers[type] = fn;
			return group;
		},
	};
	return { group, handlers };
}

function hitEvent(z, pageX = 12, pageY = 34) {
	return {
		target: { classList: { contains: c => c === 'tin-isoline-hit' }, dataset: { z: String(z) } },
		pageX,
		pageY,
	};
}

function nonHitEvent() {
	return { target: { classList: { contains: () => false } }, pageX: 0, pageY: 0 };
}

afterEach(() => {
	hideChartTooltip();
	document.body.innerHTML = '';
});

describe('createIsolineHoverHandlers', () => {
	it('registers pointerover/pointermove/pointerout on the group', () => {
		const { group, handlers } = makeStubGroup();
		createIsolineHoverHandlers({ axisLabels: AXIS_LABELS, locale: undefined })(group);
		expect(Object.keys(handlers).sort()).toEqual(['pointermove', 'pointerout', 'pointerover']);
	});

	it('shows the Z tooltip on hover, repositions on move, hides on out', () => {
		const { group, handlers } = makeStubGroup();
		createIsolineHoverHandlers({ axisLabels: AXIS_LABELS, locale: undefined })(group);

		handlers.pointerover(hitEvent(7));
		let tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.style.display).toBe('block');
		expect(tooltip.textContent).toContain('Elev');
		expect(tooltip.textContent).toContain('7');
		const initialPosition = { left: tooltip.style.left, top: tooltip.style.top };

		handlers.pointermove(hitEvent(7, 120, 140));
		tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.display).toBe('block');
		expect({ left: tooltip.style.left, top: tooltip.style.top }).not.toEqual(initialPosition);

		handlers.pointerout(hitEvent(7));
		expect(document.querySelector('.chart-tooltip').style.display).toBe('none');
	});

	it('ignores non-hit targets and non-finite data-z', () => {
		const { group, handlers } = makeStubGroup();
		createIsolineHoverHandlers({ axisLabels: AXIS_LABELS, locale: undefined })(group);

		handlers.pointerover(nonHitEvent());
		expect(document.querySelector('.chart-tooltip')).toBeNull();

		handlers.pointerover(hitEvent('not-a-number'));
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip === null || tooltip.style.display !== 'block').toBe(true);
	});

	it('attaches independently to multiple groups (isoline + threshold paths)', () => {
		const attach = createIsolineHoverHandlers({ axisLabels: AXIS_LABELS, locale: undefined });
		const a = makeStubGroup();
		const b = makeStubGroup();
		attach(a.group);
		attach(b.group);
		expect(typeof a.handlers.pointerover).toBe('function');
		expect(typeof b.handlers.pointerover).toBe('function');

		b.handlers.pointerover(hitEvent(3));
		expect(document.querySelector('.chart-tooltip').textContent).toContain('3');
	});
});
