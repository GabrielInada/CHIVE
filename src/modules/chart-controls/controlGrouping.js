/**
 * Control Grouping Utility
 * 
 * Provides helpers to organize chart controls into logical, collapsible sections.
 * Improves UX by grouping related controls and reducing cognitive overload.
 */

import { createSvgIcon } from './svgIcons.js';

/**
 * Create a collapsible section for related controls
 * @param {string} sectionId - Unique ID for the section
 * @param {string} title - Localized section title
 * @param {HTMLElement[]} controls - Array of control elements to group
 * @param {boolean} expanded - Whether section starts expanded (default: true for critical sections)
 * @param {string} iconType - Optional SVG icon type ('filter', 'data', 'display', 'styling', 'advanced')
 * @returns {HTMLElement} Collapsible section container
 */
export function createControlSection(sectionId, title, controls, expanded = true, iconType = '') {
	const section = document.createElement('div');
	section.className = 'chart-control-section';
	section.dataset.section = sectionId;

	// Header with toggle
	const header = document.createElement('button');
	header.className = 'chart-section-header';
	header.type = 'button';
	header.setAttribute('aria-expanded', expanded);

	const headerText = document.createElement('span');
	headerText.className = 'chart-section-title';
	
	// Add SVG icon if provided
	if (iconType) {
		const icon = createSvgIcon(iconType, 16);
		headerText.appendChild(icon);
		headerText.appendChild(document.createTextNode(` ${title}`));
	} else {
		headerText.textContent = title;
	}

	const toggleIcon = document.createElement('span');
	toggleIcon.className = 'chart-section-toggle';
	toggleIcon.textContent = expanded ? '▼' : '▶';

	header.appendChild(headerText);
	header.appendChild(toggleIcon);

	// Content container
	const content = document.createElement('div');
	content.className = 'chart-section-content';
	content.style.display = expanded ? 'block' : 'none';

	// Add all controls to content
	controls.forEach(control => {
		content.appendChild(control);
	});

	// Toggle behavior
	header.addEventListener('click', (e) => {
		e.preventDefault();
		const isExpanded = header.getAttribute('aria-expanded') === 'true';
		header.setAttribute('aria-expanded', !isExpanded);
		content.style.display = isExpanded ? 'none' : 'block';
		toggleIcon.textContent = isExpanded ? '▶' : '▼';
	});

	section.appendChild(header);
	section.appendChild(content);

	return section;
}

/**
 * Group multiple control sections into a container
 * @param {Object[]} sections - Array of {id, title, controls, expanded, icon} objects
 * @returns {HTMLElement[]} Array of control section elements ready to append
 */
export function groupControls(sections) {
	return sections.map(({ id, title, controls, expanded = true, icon = '' }) => 
		createControlSection(id, title, controls, expanded, icon)
	);
}

/**
 * Flatten grouped controls back to array (for backward compatibility if needed)
 * @param {HTMLElement[]} groupedControls - Array of control section elements
 * @returns {HTMLElement[]} Flat array of all control elements
 */
export function flattenGroupedControls(groupedControls) {
	const flattened = [];
	groupedControls.forEach(section => {
		if (section.classList.contains('chart-control-section')) {
			const content = section.querySelector('.chart-section-content');
			if (content) {
				flattened.push(...Array.from(content.children));
			}
		} else {
			flattened.push(section);
		}
	});
	return flattened;
}
