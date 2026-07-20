// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { ACCEPT_ATTRIBUTE, DELIMITED_EXTENSIONS } from '../../src/config/formats.js';
import {
	PREVIEW_DEFAULT_ROWS,
	PREVIEW_MAX_ROWS,
	PREVIEW_MIN_ROWS,
} from '../../src/config/limits.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../src/charts/workspaceDomIds.js';
import { SETTINGS_IDS } from '../../src/features/settings/domIds.js';
import {
	BADGE_IDS,
	FILE_IDS,
	TAB_CONTENT_IDS,
	VIEW_IDS,
	WORKSPACE_ACTION_IDS,
} from '../../src/features/datasetWorkspace/domIds.js';
import { PANEL_DOM_IDS } from '../../src/features/panel/domIds.js';
import { PROJECT_TRANSFER_IDS } from '../../src/app/bindings/projectTransfer.js';

const repoRoot = path.resolve('.');

function readDocument(fileName) {
	const html = readFileSync(path.join(repoRoot, fileName), 'utf8');
	return new JSDOM(html).window.document;
}

function expectIds(document, contracts) {
	for (const contract of contracts) {
		for (const id of Object.values(contract)) {
			expect(document.getElementById(id), `expected #${id} in index.html`).not.toBeNull();
		}
	}
}

describe('static HTML contracts', () => {
	const indexDocument = readDocument('index.html');
	const aboutDocument = readDocument('about.html');

	it('keeps the file picker accept attribute aligned with format configuration', () => {
		const accept = indexDocument.getElementById(FILE_IDS.fileInput)?.getAttribute('accept');
		expect(accept).toBe(ACCEPT_ATTRIBUTE);

		const tokens = new Set(accept.split(',').map(token => token.trim()));
		for (const extension of [...DELIMITED_EXTENSIONS, 'json']) {
			expect(tokens.has(`.${extension}`), `expected .${extension} in the accept attribute`).toBe(true);
		}
	});

	it('keeps preview row options aligned with configured limits and default', () => {
		const select = indexDocument.getElementById('select-preview-rows');
		expect(select).not.toBeNull();

		const values = [...select.options].map(option => Number(option.value));
		const selected = [...select.options].find(option => option.selected);

		expect(Math.min(...values)).toBe(PREVIEW_MIN_ROWS);
		expect(Math.max(...values)).toBe(PREVIEW_MAX_ROWS);
		expect(Number(selected?.value)).toBe(PREVIEW_DEFAULT_ROWS);
	});

	it('keeps every chart workspace contract present in the application page', () => {
		expectIds(indexDocument, [CHART_CONTAINERS, CHART_BLOCKS]);
	});

	it('keeps the shared settings button present on both pages', () => {
		expect(indexDocument.getElementById(SETTINGS_IDS.button)).not.toBeNull();
		expect(aboutDocument.getElementById(SETTINGS_IDS.button)).not.toBeNull();
	});

	it('provides matching polite and assertive feedback regions on both pages', () => {
		for (const document of [indexDocument, aboutDocument]) {
			const feedback = document.getElementById('feedback-region');
			const errors = document.getElementById('errors-container');

			expect(feedback?.getAttribute('aria-live')).toBe('polite');
			expect(errors?.getAttribute('aria-live')).toBe('assertive');
			expect(feedback?.getAttribute('aria-atomic')).toBe('false');
			expect(errors?.getAttribute('aria-atomic')).toBe('false');
		}
	});

	it('uses native navigation, upload, and disclosure semantics', () => {
		expect(indexDocument.querySelector('nav a[aria-current="page"]')?.getAttribute('href')).toBe('./index.html');
		expect(aboutDocument.querySelector('nav a[aria-current="page"]')?.getAttribute('href')).toBe('./about.html');

		const uploadZone = indexDocument.getElementById(FILE_IDS.uploadZone);
		expect(uploadZone?.tagName).toBe('BUTTON');
		expect(uploadZone?.getAttribute('type')).toBe('button');
		expect(uploadZone?.hasAttribute('role')).toBe(false);

		const projectButton = indexDocument.getElementById(PROJECT_TRANSFER_IDS.projectMenuButton);
		const projectPanel = indexDocument.getElementById(PROJECT_TRANSFER_IDS.projectMenuPanel);
		expect(projectButton?.getAttribute('aria-controls')).toBe(PROJECT_TRANSFER_IDS.projectMenuPanel);
		expect(projectButton?.hasAttribute('aria-haspopup')).toBe(false);
		expect(projectPanel?.hasAttribute('role')).toBe(false);

		const external = aboutDocument.querySelector('a[target="_blank"]');
		expect(external?.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
	});

	it('preloads only the critical WOFF2 faces on both pages', () => {
		const expected = [
			'./vendor/fonts/ibm-plex-sans/IBMPlexSans-VariableFont_wdth,wght.woff2',
			'./vendor/fonts/ibm-plex-serif/IBMPlexSerif-Bold.woff2',
		];

		for (const document of [indexDocument, aboutDocument]) {
			const preloads = [...document.querySelectorAll('link[rel="preload"][as="font"]')];
			expect(preloads.map(link => link.getAttribute('href'))).toEqual(expected);
			expect(preloads.every(link =>
				link.getAttribute('type') === 'font/woff2' && link.hasAttribute('crossorigin')
			)).toBe(true);
		}
	});

	it('ships a visible recoverable startup screen and a hidden inert shell', () => {
		for (const document of [indexDocument, aboutDocument]) {
			const startup = document.getElementById('startup-screen');
			const message = document.getElementById('startup-message');
			const reload = document.getElementById('startup-reload');
			const shell = document.getElementById('app-shell');

			expect(startup?.hidden).toBe(false);
			expect(startup?.getAttribute('role')).toBe('status');
			expect(message?.dataset.loadingEn).toBe('Loading CHIVE…');
			expect(message?.dataset.loadingPt).toBe('Carregando o CHIVE…');
			expect(reload?.hidden).toBe(true);
			expect(shell?.hidden).toBe(true);
			expect(shell?.hasAttribute('inert')).toBe(true);
			expect(document.querySelector('style')?.textContent || '').not.toContain('visibility');
			expect(document.querySelector('script[src="./src/entries/startupGuard.js"]')?.type).toBe('module');
		}
	});

	it('modulepreloads exactly the page entry used by each shell', () => {
		expect([...indexDocument.querySelectorAll('link[rel="modulepreload"]')]
			.map(link => link.getAttribute('href'))).toEqual(['./src/entries/app.js']);
		expect([...aboutDocument.querySelectorAll('link[rel="modulepreload"]')]
			.map(link => link.getAttribute('href'))).toEqual(['./src/entries/about.js']);
	});

	it('keeps feature-owned and project-transfer contracts present in the application page', () => {
		expectIds(indexDocument, [
			VIEW_IDS,
			FILE_IDS,
			BADGE_IDS,
			TAB_CONTENT_IDS,
			WORKSPACE_ACTION_IDS,
			{ canvas: PANEL_DOM_IDS.canvas },
			PROJECT_TRANSFER_IDS,
		]);
	});
});
