import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RUNTIME_FILE_SET } from '../../scripts/runtime-manifest.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const manifest = [...RUNTIME_FILE_SET].sort();

function readRepoFile(relativePath) {
	return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function normalizeEntry(entry) {
	return entry.trim().replace(/^\.\//, '').replace(/\/+$/, '');
}

function expectExactSet(actual, sourceName) {
	expect(
		[...new Set(actual.map(normalizeEntry))].sort(),
		`${sourceName} runtime files differ; update ${sourceName} or scripts/runtime-manifest.mjs so they agree.`,
	).toEqual(manifest);
}

function extractDockerRuntimeSources(dockerfile) {
	const sources = [];
	for (const line of dockerfile.split(/\r?\n/)) {
		const match = line.match(/^\s*COPY\s+(.+?)\s+(\S+)\s*$/);
		if (!match || !match[2].startsWith('/usr/share/nginx/html')) continue;
		sources.push(...match[1].trim().split(/\s+/));
	}
	return sources;
}

function extractWorkflowTriggerPaths(workflow) {
	const lines = workflow.split(/\r?\n/);
	const start = lines.findIndex(line => line.trim() === 'paths:');
	if (start === -1) return [];

	const baseIndent = lines[start].search(/\S/);
	const paths = [];
	for (const line of lines.slice(start + 1)) {
		if (!line.trim()) continue;
		const indent = line.search(/\S/);
		if (indent <= baseIndent) break;
		const match = line.match(/^\s*-\s+(.+?)\s*$/);
		if (match) paths.push(match[1]);
	}
	return paths;
}

function extractPreparedSiteSources(workflow) {
	const lines = workflow.split(/\r?\n/);
	const stepStart = lines.findIndex(line =>
		line.trim() === '- name: Prepare static site');
	if (stepStart === -1) return [];

	const runStart = lines.findIndex(
		(line, index) => index > stepStart && line.trim() === 'run: |',
	);
	if (runStart === -1) return [];

	const runIndent = lines[runStart].search(/\S/);
	const sources = [];
	for (const line of lines.slice(runStart + 1)) {
		if (!line.trim()) continue;
		const indent = line.search(/\S/);
		if (indent <= runIndent) break;
		const command = line.trim();
		if (!command.startsWith('cp ')) continue;

		const operands = command
			.split(/\s+/)
			.slice(1)
			.filter(token => !token.startsWith('-'));
		sources.push(...operands.slice(0, -1));
	}
	return sources;
}

function extractStaticHostingMinimum(staticHostingDoc) {
	const lines = staticHostingDoc.split(/\r?\n/);
	const start = lines.findIndex(line =>
		line.includes('Serve these files and folders at minimum:'));
	if (start === -1) return [];

	const entries = [];
	for (const line of lines.slice(start + 1)) {
		const match = line.match(/^\s*-\s+`([^`]+)`\s*$/);
		if (!match) {
			if (entries.length && line.trim()) break;
			continue;
		}
		entries.push(match[1]);
	}
	return entries;
}

describe('runtime manifest parity', () => {
	it('matches Dockerfile runtime COPY sources exactly', () => {
		expectExactSet(
			extractDockerRuntimeSources(readRepoFile('Dockerfile')),
			'Dockerfile',
		);
	});

	it('is fully represented in the Pages workflow path triggers', () => {
		const workflow = extractWorkflowTriggerPaths(
			readRepoFile('.github/workflows/deploy-pages.yml'),
		);
		const expectedPaths = RUNTIME_FILE_SET.map(entry =>
			entry === 'src' || entry === 'vendor' ? `${entry}/**` : entry);
		const missing = expectedPaths.filter(entry => !workflow.includes(entry));
		expect(
			missing,
			'Pages workflow runtime triggers differ; update .github/workflows/deploy-pages.yml or scripts/runtime-manifest.mjs so they agree.',
		).toEqual([]);
	});

	it('matches the Pages static-site copy sources exactly', () => {
		expectExactSet(
			extractPreparedSiteSources(
				readRepoFile('.github/workflows/deploy-pages.yml'),
			),
			'.github/workflows/deploy-pages.yml',
		);
	});

	it('matches the static-hosting minimum file list exactly', () => {
		expectExactSet(
			extractStaticHostingMinimum(
				readRepoFile('docs/deployment/static-hosting.md'),
			),
			'docs/deployment/static-hosting.md',
		);
	});
});
