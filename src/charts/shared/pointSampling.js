/**
 * Deterministic, extrema-preserving sampling for point geometry.
 *
 * The returned array never exceeds `maxItems`, contains no duplicate source
 * entries, remains in source order, and spans the full input rather than
 * taking a biased prefix. Finite minima and maxima from each accessor are
 * always retained when the budget can hold them.
 */

/**
 * @template T
 * @param {T[]} items
 * @param {number} maxItems
 * @param {Array<(item: T) => number>} [extremaAccessors=[]]
 * @returns {T[]}
 */
export function sampleWithExtrema(items, maxItems, extremaAccessors = []) {
	if (!Array.isArray(items) || items.length === 0) return [];

	const limit = Math.max(0, Math.floor(Number(maxItems) || 0));
	if (limit === 0) return [];
	if (items.length <= limit) return items;

	const picked = new Set();
	for (const accessor of extremaAccessors) {
		let minValue = Infinity;
		let maxValue = -Infinity;
		let minIndex = -1;
		let maxIndex = -1;

		for (let index = 0; index < items.length; index++) {
			const value = Number(accessor(items[index]));
			if (!Number.isFinite(value)) continue;
			if (value < minValue) {
				minValue = value;
				minIndex = index;
			}
			if (value > maxValue) {
				maxValue = value;
				maxIndex = index;
			}
		}

		if (minIndex >= 0) picked.add(minIndex);
		if (maxIndex >= 0) picked.add(maxIndex);
	}

	if (picked.size > limit) {
		return [...picked]
			.sort((a, b) => a - b)
			.slice(0, limit)
			.map(index => items[index]);
	}

	const remaining = limit - picked.size;
	if (remaining > 0) {
		const stride = items.length / remaining;
		for (let index = 0; index < remaining; index++) {
			picked.add(Math.min(items.length - 1, Math.floor((index + 0.5) * stride)));
		}
	}

	// Extrema can collide with stride picks. Fill the small remainder with a
	// second evenly distributed pass before falling back to source order.
	for (let index = 0; picked.size < limit && index < items.length; index++) {
		const position = Math.floor((((index * 0.61803398875) + 0.25) % 1) * items.length);
		picked.add(position);
	}

	return [...picked]
		.sort((a, b) => a - b)
		.slice(0, limit)
		.map(index => items[index]);
}
