import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getActiveDataset: vi.fn(),
	t: vi.fn(key => `tr:${key}`),
}));

vi.mock('../../../src/services/i18nService.js', () => ({ t: mocks.t }));
vi.mock('../../../src/state/appState.js', () => ({ getActiveDataset: mocks.getActiveDataset }));

import {
	buildChartSnapshotMetadata,
	getChartSnapshotTitle,
} from '../../../src/app/bindings/chartSnapshotMetadata.js';
import { CHART_CONTAINERS } from '../../../src/charts/workspaceDomIds.js';
import { CHART_TYPE_KEYS } from '../../../src/config/charts/definitions.js';

function withConfig(chartConfig) {
	mocks.getActiveDataset.mockReturnValue({ chartConfig });
}

describe('buildChartSnapshotMetadata', () => {
	beforeEach(() => {
		mocks.getActiveDataset.mockReset();
	});

	it('returns an empty object for an unknown container or a missing config', () => {
		withConfig({});
		expect(buildChartSnapshotMetadata('not-a-chart')).toEqual({});

		mocks.getActiveDataset.mockReturnValue(null);
		expect(buildChartSnapshotMetadata(CHART_CONTAINERS.bar)).toEqual({});

		mocks.getActiveDataset.mockReturnValue({});
		expect(buildChartSnapshotMetadata(CHART_CONTAINERS.bar)).toEqual({});
	});

	it.each(CHART_TYPE_KEYS)('has a builder for the %s chart', (type) => {
		withConfig({});
		const metadata = buildChartSnapshotMetadata(CHART_CONTAINERS[type]);
		expect(metadata.type).toBe(type);
		expect(typeof metadata.summary).toBe('string');
	});

	it('fills every unset field with placeholders when the chart has no config yet', () => {
		withConfig({});
		const build = type => buildChartSnapshotMetadata(CHART_CONTAINERS[type]);

		expect(build('bar').summary).toBe(
			'tr:chive-chart-control-bar-category: - · tr:chive-chart-control-measure-count',
		);
		expect(build('scatter').summary).toBe('X: - · Y: -');
		expect(build('pie')).toEqual({
			type: 'pie',
			measureMode: undefined,
			valueColumn: null,
			innerRadius: undefined,
			outerRadius: undefined,
			padAngle: 0,
			labelPosition: undefined,
			summary: 'tr:chive-chart-control-pie-category: - · tr:chive-chart-control-measure-count'
				+ ' · tr:chive-chart-control-pie-pad-angle: 0deg',
		});
		expect(build('bubble')).toMatchObject({
			category: '-',
			valueColumn: null,
			groupColumn: null,
			summary: 'tr:chive-chart-control-bubble-category: - · tr:chive-chart-control-measure-count'
				+ ' · tr:chive-chart-control-bubble-topn: tr:chive-chart-topn-all',
		});
		expect(build('network')).toMatchObject({ source: '-', target: '-', weight: null });
		expect(build('treemap')).toMatchObject({ category: '-', valueColumn: null });
		expect(build('line')).toMatchObject({ x: '-', y: '-' });
		expect(build('tin')).toMatchObject({ x: '-', y: '-', z: '-' });
		expect(build('scatter3d')).toMatchObject({ x: '-', y: '-', z: '-' });
	});

	it('names the value column for sum and mean measures, with a placeholder when unset', () => {
		withConfig({
			bar: { category: 'region', measureMode: 'sum', valueColumn: 'sales' },
			treemap: { category: 'region', measureMode: 'mean' },
		});

		expect(buildChartSnapshotMetadata(CHART_CONTAINERS.bar).summary).toBe(
			'tr:chive-chart-control-bar-category: region · tr:chive-chart-control-measure-sum'
				+ ' · tr:chive-chart-control-value-column: sales',
		);
		expect(buildChartSnapshotMetadata(CHART_CONTAINERS.treemap).summary).toBe(
			'tr:chive-chart-control-treemap-category: region · tr:chive-chart-control-measure-mean'
				+ ' · tr:chive-chart-control-value-column: -',
		);
	});

	it('includes the bubble group and a numeric top-N when set', () => {
		withConfig({ bubble: { category: 'city', groupColumn: 'state', topN: 10 } });

		expect(buildChartSnapshotMetadata(CHART_CONTAINERS.bubble)).toMatchObject({
			category: 'city',
			groupColumn: 'state',
			topN: 10,
			summary: 'tr:chive-chart-control-bubble-category: city · tr:chive-chart-control-measure-count'
				+ ' · tr:chive-chart-control-bubble-group: state · tr:chive-chart-control-bubble-topn: 10',
		});
	});

	it('coerces the pie pad angle to a number', () => {
		withConfig({ pie: { category: 'kind', padAngle: '2' } });
		const metadata = buildChartSnapshotMetadata(CHART_CONTAINERS.pie);
		expect(metadata.padAngle).toBe(2);
		expect(metadata.summary).toContain('tr:chive-chart-control-pie-pad-angle: 2deg');
	});

	it('carries the network weight when one is chosen', () => {
		withConfig({ network: { source: 'from', target: 'to', weight: 'amount' } });
		expect(buildChartSnapshotMetadata(CHART_CONTAINERS.network)).toEqual({
			type: 'network',
			source: 'from',
			target: 'to',
			weight: 'amount',
			summary: 'tr:chive-chart-control-network-source: from · tr:chive-chart-control-network-target: to',
		});
	});
});

describe('getChartSnapshotTitle', () => {
	beforeEach(() => {
		mocks.getActiveDataset.mockReset();
	});

	it('prefers the trimmed custom title for the chart behind the container', () => {
		withConfig({ line: { customTitle: '  Revenue over time  ' } });
		expect(getChartSnapshotTitle(CHART_CONTAINERS.line, 'Fallback')).toBe('Revenue over time');
	});

	it('falls back when the custom title is blank, absent, or the dataset is missing', () => {
		withConfig({ line: { customTitle: '   ' } });
		expect(getChartSnapshotTitle(CHART_CONTAINERS.line, 'Fallback')).toBe('Fallback');

		withConfig({});
		expect(getChartSnapshotTitle(CHART_CONTAINERS.line, 'Fallback')).toBe('Fallback');

		mocks.getActiveDataset.mockReturnValue(null);
		expect(getChartSnapshotTitle(CHART_CONTAINERS.line, 'Fallback')).toBe('Fallback');
	});

	it('returns the fallback for an unknown container without reading state', () => {
		expect(getChartSnapshotTitle('not-a-chart', 'Fallback')).toBe('Fallback');
		expect(mocks.getActiveDataset).not.toHaveBeenCalled();
	});
});
