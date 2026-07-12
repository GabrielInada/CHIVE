/**
 * SVG Icon Utilities for Chart Control Sections
 * Loads external SVG files from src/icons/
 */

/**
 * Create an SVG image element for the given icon type
 * @param {string} iconType - 'filter', 'data', 'display', 'styling', or 'advanced'
 * @param {number} size - Icon size in pixels (default: 16)
 * @returns {HTMLImageElement} Image element pointing to the SVG icon
 */
export function createSvgIcon(iconType, size = 16) {
	const img = document.createElement('img');
	img.src = `src/icons/${iconType}.svg`;
	img.alt = iconType;
	img.width = size;
	img.height = size;
	img.className = `svg-icon svg-icon-${iconType}`;
	img.style.display = 'inline-block';
	img.style.verticalAlign = 'middle';
	img.style.marginRight = '6px';
	img.style.flexShrink = '0';

	return img;
}
