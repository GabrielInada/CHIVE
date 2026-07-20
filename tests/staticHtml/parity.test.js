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
