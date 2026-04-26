/**
 * SVG Icon Utilities for Chart Control Sections
 * Loads external SVG files from icons/
 */

/**
 * Create an SVG image element for the given icon type
 * @param {string} iconType - 'filter', 'data', 'display', 'styling', or 'advanced'
 * @param {number} size - Icon size in pixels (default: 16)
 * @returns {HTMLImageElement} Image element pointing to the SVG icon
 */
export function createSvgIcon(iconType, size = 16) {
	const img = document.createElement('img');
	img.src = `icons/${iconType}.svg`;
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

/**
 * Get standardized SVG styling for consistency
 */
export function getSvgIconStyle() {
	return `
		.svg-icon {
			display: inline-block;
			vertical-align: middle;
			color: inherit;
		}
		.svg-icon-filter { color: #c8ff4d; }
		.svg-icon-data { color: #6496ff; }
		.svg-icon-display { color: #9664ff; }
		.svg-icon-styling { color: #ff9664; }
		.svg-icon-advanced { color: #999999; }
	`;
}
