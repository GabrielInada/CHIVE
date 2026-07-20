import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const stylesRoot = path.resolve('src/styles');
const appStyles = [
	'layers.css',
	'variables.css',
	'animations.css',
	'layout.css',
	'collapsed.css',
	'responsive.css',
	'header-nav.css',
	'settings.css',
	'buttons.css',
	'upload.css',
	'columns.css',
	'chart-controls.css',
	'dataset-workspace.css',
	'table.css',
	'chart-output.css',
	'chart-picker.css',
	'panel.css',
	'messages.css',
];
const aboutStyles = [
	'layers.css',
	'variables.css',
	'layout.css',
	'responsive.css',
	'header-nav.css',
	'settings.css',
	'messages.css',
	'about.css',
];

function readStyle(fileName) {
	return readFileSync(path.join(stylesRoot, fileName), 'utf8');
}

function pageStyles(fileName) {
	const document = new JSDOM(readFileSync(path.resolve(fileName), 'utf8')).window.document;
	return [...document.querySelectorAll('link[rel="stylesheet"]')]
		.map(link => link.getAttribute('href'))
		.filter(href => href.startsWith('./src/styles/'))
		.map(href => path.basename(href));
}

describe('cascade layer composition', () => {
	it('declares one canonical layer order', () => {
		expect(readStyle('layers.css')).toContain(
			'@layer foundation, controls, data-view, visual-output, feedback;'
		);
	});

	it('loads the exact application styles in cascade order', () => {
		expect(pageStyles('index.html')).toEqual(appStyles);
	});

	it('keeps about.css unlayered and last on the about page', () => {
		expect(pageStyles('about.html')).toEqual(aboutStyles);
		expect(readStyle('about.css')).not.toMatch(/^\s*@layer\b/m);
	});

	it('does not use runtime CSS imports or nested layer names', () => {
		for (const fileName of readdirSync(stylesRoot).filter(name => name.endsWith('.css'))) {
			const source = readStyle(fileName);
			expect(source, fileName).not.toMatch(/@import\b/);
			expect(source, fileName).not.toContain('foundation.foundation');
			expect(source, fileName).not.toContain('!important');
		}
	});

	it('assigns every shared leaf stylesheet to one explicit layer', () => {
		for (const fileName of appStyles.slice(1)) {
			if (fileName === 'about.css') continue;
			expect(readStyle(fileName), fileName).toMatch(/^\s*@layer (foundation|controls|data-view|visual-output|feedback) \{/);
		}
	});
});
