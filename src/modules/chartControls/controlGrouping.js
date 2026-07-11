/**
 * CHIVE chart-control grouping utility.
 *
 * Wraps related controls in a collapsible section. Used by per-chart
 * control modules (`charts/bar/controls/builder.js`, legacy controls, etc.) to group "Data", "Display",
 * "Styling", etc. and keep the sidebar scannable.
 *
 * Section expansion state is preserved across sidebar re-renders by
 * {@link captureControlSectionExpansionState} and
 * {@link applyControlSectionExpansionState} in `chartControls/chartControlsManager.js`.
 */

import { createSvgIcon } from './svgIcons.js';

/**
 * Create a collapsible section for related controls. Header click toggles
 * expansion and animates the open transition; collapse is instant (no
 * animation, so the scroll-restore measurements stay accurate).
 *
 * @param {string} sectionId - Unique within the params pane (used as `data-section`).
 * @param {string} title - Localized section title.
 * @param {HTMLElement[]} controls - Control elements to wrap.
 * @param {boolean} [expanded=true] - Initial expansion state.
 * @param {string} [iconType=''] - Optional icon, see {@link createSvgIcon}.
 * @returns {HTMLElement}
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
		// Only animate on user-triggered expansion. Re-rendered sections that start
		// expanded (via applyControlSectionExpansionState after a sidebar rebuild)
		// must NOT animate, the max-height:0 start frame would throw off the
		// scroll-restore measurements in renderChartControlsSidebar.
		if (!isExpanded) {
			content.classList.add('chart-section-content--opening');
			content.addEventListener(
				'animationend',
				() => content.classList.remove('chart-section-content--opening'),
				{ once: true }
			);
		}
	});

	section.appendChild(header);
	section.appendChild(content);

	return section;
}

/**
 * Map an array of section descriptors to an array of section elements
 * via {@link createControlSection}.
 *
 * @param {Array<{ id: string, title: string, controls: HTMLElement[], expanded?: boolean, icon?: string }>} sections
 * @returns {HTMLElement[]}
 */
export function groupControls(sections) {
	return sections.map(({ id, title, controls, expanded = true, icon = '' }) =>
		createControlSection(id, title, controls, expanded, icon)
	);
}

/**
 * Flatten grouped controls back to a single array. Walks each section's
 * content children; bare (non-section) elements pass through unchanged.
 * Kept for backward compatibility with callers that build control arrays
 * but do not want the section wrappers.
 *
 * @param {HTMLElement[]} groupedControls
 * @returns {HTMLElement[]}
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
