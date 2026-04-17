/**
 * Centralized color utility functions used by visualization modules
 * and chart controls.
 */

export function hexToRgb(hex) {
	const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
	if (!match) return { r: 0, g: 0, b: 0 };
	return {
		r: parseInt(match[1], 16),
		g: parseInt(match[2], 16),
		b: parseInt(match[3], 16),
	};
}

export function toHex(value) {
	return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}

export function rgbToHex(r, g, b) {
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function interpolateColor(minColor, maxColor, t) {
	const clamped = Math.max(0, Math.min(1, t));
	const start = hexToRgb(minColor);
	const end = hexToRgb(maxColor);
	return rgbToHex(
		start.r + ((end.r - start.r) * clamped),
		start.g + ((end.g - start.g) * clamped),
		start.b + ((end.b - start.b) * clamped),
	);
}

export function parseHexColor(color) {
	const normalized = String(color || '').trim();
	if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null;
	return {
		r: parseInt(normalized.slice(1, 3), 16),
		g: parseInt(normalized.slice(3, 5), 16),
		b: parseInt(normalized.slice(5, 7), 16),
	};
}

export function buildSliceColor(baseHex, index, fallbackHex) {
	const rgb = parseHexColor(baseHex) || parseHexColor(fallbackHex);
	if (!rgb) return baseHex;
	const factor = 1 - (Math.min(index, 8) * 0.08);
	const r = rgb.r * factor;
	const g = rgb.g * factor;
	const b = rgb.b * factor;
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
