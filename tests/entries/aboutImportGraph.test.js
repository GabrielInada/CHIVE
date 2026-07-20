import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { moduleScriptSrcs, staticClosure } from '../helpers/importGraph.js';

/**
 * Static import-graph guard for the page entries.
 *
 * The About page must load only shared header behavior (i18n + settings). This
 * walks the real static module graph from the entry declared in about.html and
 * asserts its complete closure against an explicit allowlist, so any new About
 * dependency fails here and forces a review. Edges are collected from the AST
 * (ImportDeclaration incl. side-effect, ExportNamedDeclaration with a source,
 * ExportAllDeclaration) rather than by regex, so JSDoc `import(...)` typedefs in
 * comments and string coincidences are never miscounted. Dynamic `import()` is
 * tracked separately and is not part of the static startup graph.
 */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// The complete intended static closure reachable from the About entry.
const ABOUT_ALLOWLIST = new Set([
	'src/entries/about.js',
	'src/app/startupScreen.js',
	'src/app/sharedPageInitializer.js',
	'src/features/settings/settingsController.js',
	'src/features/settings/settingsDialog.js',
	'src/ui/nativeDialog.js',
	'src/services/i18nService.js',
	'src/services/settingsService.js',
	'src/services/storageService.js',
	'src/config/locale.js',
	'src/config/settings.js',
	'src/features/settings/domIds.js',
	'src/utils/result.js',
	'src/utils/formatters.js',
	'vendor/banana-i18n/banana-i18n.js',
]);

// Modules that must never appear in the About closure (heavy app graph + the
// other entry + the heavy vendor libs).
const FORBIDDEN_ON_ABOUT = [
	'src/app/applicationInitializer.js',
	'src/ui/feedback.js',
	'src/app/debugApi.js',
	'src/app/renderCoordinator.js',
	'src/entries/app.js',
	'vendor/d3/d3.js',
	'vendor/three/three.module.js',
	'vendor/three/three.core.js',
];

// Directory prefixes that carry the heavy graph; a defence-in-depth check
// alongside the exact allowlist. The settings feature package is expected on
// About, so features/ is banned per heavy package rather than wholesale.
const FORBIDDEN_PREFIXES = [
	'src/charts/',
	'src/state/',
	'src/features/datasetWorkspace/',
	'src/features/panel/',
	'src/services/persistence',
	'src/domain/',
	'src/workers/',
];

function htmlEntry(htmlRelPath) {
	const srcs = moduleScriptSrcs(repoRoot, htmlRelPath);
	const expectedEntry = htmlRelPath === 'about.html'
		? 'src/entries/about.js'
		: 'src/entries/app.js';
	expect(srcs, `${htmlRelPath} must declare the guard followed by one page entry`).toEqual([
		'src/entries/startupGuard.js',
		expectedEntry,
	]);
	return srcs[1];
}

describe('page entry HTML wiring', () => {
	it('about.html points at the About entry', () => {
		expect(htmlEntry('about.html')).toBe('src/entries/about.js');
	});

	it('index.html points at the application entry', () => {
		expect(htmlEntry('index.html')).toBe('src/entries/app.js');
	});
});

describe('About page static import graph', () => {
	const entry = htmlEntry('about.html');
	const { visited, bareSpecs, dynamicReached } = staticClosure(repoRoot, entry);

	it('actually traversed the shared graph', () => {
		for (const expected of [
			'src/entries/about.js',
			'src/app/sharedPageInitializer.js',
			'src/services/i18nService.js',
			'vendor/banana-i18n/banana-i18n.js',
		]) {
			expect(visited.has(expected), `expected ${expected} in the About closure`).toBe(true);
		}
	});

	it('reaches nothing outside the allowlist', () => {
		const unexpected = [...visited].filter(file => !ABOUT_ALLOWLIST.has(file)).sort();
		expect(unexpected, `unexpected modules reachable from About: ${unexpected.join(', ')}`).toEqual([]);
	});

	it('never reaches the heavy app graph, the app entry, or D3/Three.js', () => {
		for (const forbidden of FORBIDDEN_ON_ABOUT) {
			expect(visited.has(forbidden), `About must not import ${forbidden}`).toBe(false);
		}
		const leaked = [...visited].filter(file => FORBIDDEN_PREFIXES.some(prefix => file.startsWith(prefix)));
		expect(leaked, `About leaked heavy modules: ${leaked.join(', ')}`).toEqual([]);
	});

	it('uses only relative specifiers (raw-static hosting)', () => {
		expect([...bareSpecs], `bare specifiers break raw-static hosting: ${[...bareSpecs].join(', ')}`).toEqual([]);
	});

	it('has no dynamic import into a forbidden module', () => {
		const badDynamic = [...dynamicReached].filter(
			file => FORBIDDEN_ON_ABOUT.includes(file) || FORBIDDEN_PREFIXES.some(prefix => file.startsWith(prefix)),
		);
		expect(badDynamic, `About dynamically imports heavy modules: ${badDynamic.join(', ')}`).toEqual([]);
	});
});
