// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	filterVisibleColumns: vi.fn(() => [{ nome: 'categoria' }, { nome: 'valor' }]),
	getNumericColumnNames: vi.fn(() => ['valor']),
	getCategoricalColumnNames: vi.fn(() => ['categoria']),
	mergeChartConfigWithDefaults: vi.fn(config => ({
		bar: { enabled: true, expanded: false },
		scatter: { enabled: true, expanded: false },
		pie: { enabled: true, expanded: false },
		bubble: { enabled: true, expanded: false },
		network: { enabled: true, expanded: false },
		treemap: { enabled: true, expanded: false },
		...config,
	})),
	onStateChange: vi.fn(),
	createBarChartControls: vi.fn(() => []),
	setupBarChartControlListeners: vi.fn(),
	createBubbleChartControls: vi.fn(() => []),
	setupBubbleChartControlListeners: vi.fn(),
	createNetworkGraphControls: vi.fn(() => []),
	setupNetworkGraphControlListeners: vi.fn(),
	createScatterPlotControls: vi.fn(() => []),
	setupScatterPlotControlListeners: vi.fn(),
	createPieChartControls: vi.fn(() => []),
	setupPieChartControlListeners: vi.fn(),
	createTreeMapControls: vi.fn(() => []),
	setupTreeMapControlListeners: vi.fn(),
	createChartCard: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/utils/columnHelpers.js', () => ({
	filterVisibleColumns: mocks.filterVisibleColumns,
	getNumericColumnNames: mocks.getNumericColumnNames,
	getCategoricalColumnNames: mocks.getCategoricalColumnNames,
}));

vi.mock('../../../src/config/chartDefaults.js', () => ({
	mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults,
}));

vi.mock('../../../src/modules/appState.js', () => ({
	onStateChange: mocks.onStateChange,
	STATE_EVENTS: {
		CHART_EXPANDED_CHANGED: 'chartExpandedChanged',
	},
}));

vi.mock('../../../src/modules/chart-controls/barControls.js', () => ({
	createBarChartControls: mocks.createBarChartControls,
	setupBarChartControlListeners: mocks.setupBarChartControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/bubbleControls.js', () => ({
	createBubbleChartControls: mocks.createBubbleChartControls,
	setupBubbleChartControlListeners: mocks.setupBubbleChartControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/networkControls.js', () => ({
	createNetworkGraphControls: mocks.createNetworkGraphControls,
	setupNetworkGraphControlListeners: mocks.setupNetworkGraphControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/scatterControls.js', () => ({
	createScatterPlotControls: mocks.createScatterPlotControls,
	setupScatterPlotControlListeners: mocks.setupScatterPlotControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/pieControls.js', () => ({
	createPieChartControls: mocks.createPieChartControls,
	setupPieChartControlListeners: mocks.setupPieChartControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/treemapControls.js', () => ({
	createTreeMapControls: mocks.createTreeMapControls,
	setupTreeMapControlListeners: mocks.setupTreeMapControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/cardFactory.js', () => ({
	createChartCard: mocks.createChartCard,
}));

vi.mock('../../../src/modules/chart-controls/previews.js', () => ({
	PREVIEW_BAR_SVG: '<svg />',
	PREVIEW_BUBBLE_SVG: '<svg />',
	PREVIEW_NETWORK_SVG: '<svg />',
	PREVIEW_PIE_SVG: '<svg />',
	PREVIEW_SCATTER_SVG: '<svg />',
	PREVIEW_TREEMAP_SVG: '<svg />',
}));

import { renderChartControlsSidebar } from '../../../src/modules/chart-controls/index.js';

function createScrollResettingContainer() {
	let html = '';
	let scrollTop = 180;

	return {
		get innerHTML() {
			return html;
		},
		set innerHTML(value) {
			html = value;
			scrollTop = 0;
		},
		get scrollTop() {
			return scrollTop;
		},
		set scrollTop(value) {
			scrollTop = value;
		},
		appendChild: vi.fn(),
	};
}

describe('renderChartControlsSidebar', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		document.body.innerHTML = '';
		mocks.createChartCard.mockReset();
	});

	it('restores the sidebar scroll position after rerendering', () => {
		const container = createScrollResettingContainer();
		vi.spyOn(document, 'getElementById').mockReturnValue(container);

		renderChartControlsSidebar({
			configGraficos: {},
		});

		expect(container.scrollTop).toBe(180);
		expect(mocks.createChartCard).toHaveBeenCalledTimes(6);
		expect(mocks.setupBarChartControlListeners).toHaveBeenCalledTimes(1);
	});

	it('restores relative viewport when active control position changes after rerender', () => {
		document.body.innerHTML = '<div id="lista-visualizacoes-conteudo" class="viz-cards"></div>';
		const container = document.getElementById('lista-visualizacoes-conteudo');

		let topAtCreation = 220;
		mocks.createChartCard.mockImplementation((parent, chartName) => {
			const card = document.createElement('article');
			card.className = 'viz-card';
			const expandBtn = document.createElement('button');
			expandBtn.className = 'viz-expand-btn';
			expandBtn.id = `viz-expand-${chartName}`;
			card.appendChild(expandBtn);

			const body = document.createElement('div');
			body.id = `viz-body-${chartName}`;
			const control = document.createElement('select');
			control.id = `viz-anchor-${chartName}`;
			const elementTop = topAtCreation;
			control.getBoundingClientRect = () => ({ top: elementTop });
			card.getBoundingClientRect = () => ({ top: elementTop - 20 });
			body.appendChild(control);
			card.appendChild(body);
			parent.appendChild(card);
		});

		renderChartControlsSidebar({ configGraficos: {} });

		container.scrollTop = 100;
		const activeControl = document.getElementById('viz-anchor-scatter');
		activeControl.focus();

		topAtCreation = 280;
		renderChartControlsSidebar({ configGraficos: {} });

		expect(container.scrollTop).toBe(160);
	});

	it('restores viewport correctly when scrollTop resets during rerender (real browser behavior)', () => {
		document.body.innerHTML = '<div id="lista-visualizacoes-conteudo" class="viz-cards"></div>';
		const container = document.getElementById('lista-visualizacoes-conteudo');

		let topAtCreation = 220;
		let simulateWipeScrollReset = false;
		let firstCardInRender = true;

		mocks.createChartCard.mockImplementation((parent, chartName) => {
			// Real browsers clamp scrollTop to 0 when innerHTML drops below clientHeight.
			// Simulate that once per render, on the first card after the wipe.
			if (simulateWipeScrollReset && firstCardInRender) {
				container.scrollTop = 0;
				firstCardInRender = false;
			}

			const card = document.createElement('article');
			card.className = 'viz-card';
			const expandBtn = document.createElement('button');
			expandBtn.className = 'viz-expand-btn';
			expandBtn.id = `viz-expand-${chartName}`;
			card.appendChild(expandBtn);

			const body = document.createElement('div');
			body.id = `viz-body-${chartName}`;
			const control = document.createElement('select');
			control.id = `viz-anchor-${chartName}`;
			const elementTop = topAtCreation;
			control.getBoundingClientRect = () => ({ top: elementTop });
			card.getBoundingClientRect = () => ({ top: elementTop - 20 });
			body.appendChild(control);
			card.appendChild(body);
			parent.appendChild(card);
		});

		renderChartControlsSidebar({ configGraficos: {} });

		container.scrollTop = 100;
		const activeControl = document.getElementById('viz-anchor-scatter');
		activeControl.focus();

		topAtCreation = 280;
		simulateWipeScrollReset = true;
		firstCardInRender = true;
		renderChartControlsSidebar({ configGraficos: {} });

		// Anchor captured at scrollTop=100 had rect.top=220. In a real browser the wipe
		// resets scrollTop to 0, and at scrollTop=0 the new element's rect.top=280.
		// To return the element to its original viewport Y (220) we adjust by delta=60
		// against the CURRENT scrollTop (0), giving 60. The previous-scrollTop baseline
		// would have overshot to 160.
		expect(container.scrollTop).toBe(60);
	});

	it('preserves expanded state of control sections after rerender', () => {
		document.body.innerHTML = '<div id="lista-visualizacoes-conteudo" class="viz-cards"></div>';
		const container = document.getElementById('lista-visualizacoes-conteudo');

		mocks.createChartCard.mockImplementation((parent, chartName) => {
			const card = document.createElement('article');
			card.className = 'viz-card';
			const expandBtn = document.createElement('button');
			expandBtn.className = 'viz-expand-btn';
			expandBtn.id = `viz-expand-${chartName}`;
			card.appendChild(expandBtn);

			const body = document.createElement('div');
			body.id = `viz-body-${chartName}`;

			const section = document.createElement('div');
			section.className = 'chart-control-section';
			section.dataset.section = 'styling';

			const header = document.createElement('button');
			header.className = 'chart-section-header';
			header.setAttribute('aria-expanded', 'false');

			const toggle = document.createElement('span');
			toggle.className = 'chart-section-toggle';
			toggle.textContent = '▶';
			header.appendChild(toggle);

			const content = document.createElement('div');
			content.className = 'chart-section-content';
			content.style.display = 'none';

			const control = document.createElement('select');
			control.id = `viz-anchor-${chartName}`;
			content.appendChild(control);

			section.appendChild(header);
			section.appendChild(content);
			body.appendChild(section);
			card.appendChild(body);
			parent.appendChild(card);
		});

		renderChartControlsSidebar({ configGraficos: {} });

		const initialSection = container.querySelector('#viz-expand-scatter')
			?.closest('.viz-card')
			?.querySelector('.chart-control-section[data-section="styling"]');
		const initialHeader = initialSection?.querySelector('.chart-section-header');
		const initialContent = initialSection?.querySelector('.chart-section-content');
		const initialToggle = initialSection?.querySelector('.chart-section-toggle');

		initialHeader?.setAttribute('aria-expanded', 'true');
		if (initialContent) initialContent.style.display = 'block';
		if (initialToggle) initialToggle.textContent = '▼';

		renderChartControlsSidebar({ configGraficos: {} });

		const nextSection = container.querySelector('#viz-expand-scatter')
			?.closest('.viz-card')
			?.querySelector('.chart-control-section[data-section="styling"]');
		const nextHeader = nextSection?.querySelector('.chart-section-header');
		const nextContent = nextSection?.querySelector('.chart-section-content');
		const nextToggle = nextSection?.querySelector('.chart-section-toggle');

		expect(nextHeader?.getAttribute('aria-expanded')).toBe('true');
		expect(nextContent?.style.display).toBe('block');
		expect(nextToggle?.textContent).toBe('▼');
	});
});