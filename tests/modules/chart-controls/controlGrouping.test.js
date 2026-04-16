// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { createControlSection, groupControls, flattenGroupedControls } from '../../../src/modules/chart-controls/controlGrouping.js';

function makeDummyControl(text = 'ctrl') {
	const el = document.createElement('div');
	el.textContent = text;
	return el;
}

describe('createControlSection', () => {
	it('creates collapsed section with hidden content', () => {
		const section = createControlSection('sec-1', 'Title', [makeDummyControl()], false);
		const content = section.querySelector('.chart-section-content');
		const header = section.querySelector('.chart-section-header');
		expect(content.style.display).toBe('none');
		expect(header.getAttribute('aria-expanded')).toBe('false');
	});

	it('creates expanded section by default', () => {
		const section = createControlSection('sec-2', 'Title', [makeDummyControl()]);
		const content = section.querySelector('.chart-section-content');
		expect(content.style.display).toBe('block');
	});

	it('toggles section on header click', () => {
		const section = createControlSection('sec-3', 'Title', [makeDummyControl()], true);
		const header = section.querySelector('.chart-section-header');
		const content = section.querySelector('.chart-section-content');
		const toggle = section.querySelector('.chart-section-toggle');

		header.click();
		expect(content.style.display).toBe('none');
		expect(toggle.textContent).toBe('▶');

		header.click();
		expect(content.style.display).toBe('block');
		expect(toggle.textContent).toBe('▼');
	});

	it('includes all provided controls in content', () => {
		const controls = [makeDummyControl('a'), makeDummyControl('b'), makeDummyControl('c')];
		const section = createControlSection('sec-4', 'Title', controls);
		const content = section.querySelector('.chart-section-content');
		expect(content.children.length).toBe(3);
	});

	it('adds icon when iconType is provided', () => {
		const section = createControlSection('sec-5', 'Title', [], true, 'filter');
		const icon = section.querySelector('img.svg-icon');
		expect(icon).not.toBeNull();
		expect(icon.alt).toBe('filter');
	});

	it('sets text without icon when iconType is empty', () => {
		const section = createControlSection('sec-6', 'My Title', [], true, '');
		const titleSpan = section.querySelector('.chart-section-title');
		expect(titleSpan.textContent).toBe('My Title');
	});
});

describe('groupControls', () => {
	it('creates sections from config array', () => {
		const sections = groupControls([
			{ id: 'a', title: 'Section A', controls: [makeDummyControl()] },
			{ id: 'b', title: 'Section B', controls: [makeDummyControl()], expanded: false },
		]);
		expect(sections.length).toBe(2);
		expect(sections[0].dataset.section).toBe('a');
		expect(sections[1].querySelector('.chart-section-content').style.display).toBe('none');
	});
});

describe('flattenGroupedControls', () => {
	it('extracts children from control sections', () => {
		const section = createControlSection('s', 'T', [makeDummyControl('x'), makeDummyControl('y')]);
		const flat = flattenGroupedControls([section]);
		expect(flat.length).toBe(2);
		expect(flat[0].textContent).toBe('x');
	});

	it('passes through non-section elements unchanged', () => {
		const plain = makeDummyControl('plain');
		const flat = flattenGroupedControls([plain]);
		expect(flat.length).toBe(1);
		expect(flat[0]).toBe(plain);
	});

	it('handles mix of sections and plain elements', () => {
		const section = createControlSection('s', 'T', [makeDummyControl()]);
		const plain = makeDummyControl();
		const flat = flattenGroupedControls([section, plain]);
		expect(flat.length).toBe(2);
	});
});
