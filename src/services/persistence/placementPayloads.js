/** Shared traversal for SQLite, normalization, and worker transport of slot captures. */

export const placementKey = (blockId, slotId) => JSON.stringify([blockId, slotId]);

export function mapPlacementPayloads(blocks, transform) {
	if (!Array.isArray(blocks)) return [];
	return blocks.map(block => {
		if (!block?.placements || typeof block.placements !== 'object') return block;
		return {
			...block,
			placements: Object.fromEntries(Object.entries(block.placements)
				.filter(([, placement]) => placement && typeof placement === 'object' && !Array.isArray(placement))
				.map(([slotId, placement]) => [slotId, transform(placement, block.id, slotId, block.slots?.[slotId])])),
		};
	});
}
