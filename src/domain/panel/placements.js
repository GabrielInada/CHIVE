/** Pure placement reads and captures; saved charts always remain the original snapshot. */

import { deriveShownDataset } from '../datasets/shownDataset.js';
import { getTemplateSlots } from './layoutTemplates.js';

export function getPlacementSource(chart, datasets) {
	return chart?.sourceDatasetId
		? datasets.find(dataset => dataset?.id === chart.sourceDatasetId) || null
		: null;
}

/** Capture from the full source, so widening its filter can restore excluded rows. */
export function capturePlacement(dataset, followGlobalFilter = true) {
	return {
		followGlobalFilter,
		dataSnapshot: structuredClone(deriveShownDataset(dataset).rows),
		columnsSnapshot: structuredClone(dataset.columns || []),
	};
}

export function hasPlacementCapture(placement) {
	return Array.isArray(placement?.dataSnapshot) && Array.isArray(placement?.columnsSnapshot);
}

/** Missing placement state is the original, frozen chart (including version-1 projects). */
export function resolvePlacement(chart, placement, datasets) {
	if (!chart) return null;
	const source = getPlacementSource(chart, datasets);
	return {
		snapshot: hasPlacementCapture(placement)
			? { ...chart, dataSnapshot: placement.dataSnapshot, columnsSnapshot: placement.columnsSnapshot }
			: chart,
		followGlobalFilter: Boolean(source && placement?.followGlobalFilter),
		sourceName: source?.name || '',
		sourceStatus: source ? 'available' : chart.sourceDatasetId ? 'missing' : 'unlinked',
	};
}

/** Hydration is a single boundary: validate captures, discard orphan slots, reconnect by ID only. */
export function reconcilePlacementBlocks(blocks, charts, datasets) {
	const chartsById = new Map(charts.map(chart => [chart.id, chart]));
	return blocks.map(block => {
		const placements = {};
		const allowed = new Set(getTemplateSlots(block.templateId));
		for (const [slotId, placement] of Object.entries(block.placements || {})) {
			const chart = chartsById.get(block.slots?.[slotId]);
			if (!allowed.has(slotId) || !chart || !placement || typeof placement !== 'object') continue;
			const source = getPlacementSource(chart, datasets);
			if (placement.followGlobalFilter === true && source) {
				placements[slotId] = capturePlacement(source);
			} else if (hasPlacementCapture(placement)) {
				placements[slotId] = {
					followGlobalFilter: false,
					dataSnapshot: placement.dataSnapshot,
					columnsSnapshot: placement.columnsSnapshot,
				};
			}
		}
		return { ...block, placements };
	});
}
