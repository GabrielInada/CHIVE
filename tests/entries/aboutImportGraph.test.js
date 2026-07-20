import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';

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

const toPosix = value => value.split(path.sep).join('/');
const relToRepo = absPath => toPosix(path.relative(repoRoot, absPath));

// The complete intended static closure reachable from the About entry.
const ABOUT_ALLOWLIST = new Set([
	'src/entries/about.js',
	'src/app/sharedPageInitializer.js',
	'src/features/settings/settingsController.js',
	'src/features/settings/settingsDialog.js',
	'src/ui/dialogFocus.js',
	'src/services/i18nService.js',
	'src/services/settingsService.js',
	'src/config/locale.js',
	'src/config/settings.js',
	'src/features/settings/domIds.js',
	'src/i18n/en.json',
	'src/i18n/pt-BR.json',
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

function collectSpecifiers(code, label) {
	const staticSpecs = [];
	const dynamicSpecs = [];
	const linter = new Linter();
	const messages = linter.verify(code, {
		languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
		plugins: {
			graph: {
				rules: {
					collect: {
						create() {
							return {
								ImportDeclaration: node => staticSpecs.push(node.source.value),
								ExportNamedDeclaration: node => { if (node.source) staticSpecs.push(node.source.value); },
								ExportAllDeclaration: node => staticSpecs.push(node.source.value),
								ImportExpression: node => {
									if (node.source && node.source.type === 'Literal' && typeof node.source.value === 'string') {
										dynamicSpecs.push(node.source.value);
									}
								},
							};
						},
					},
				},
			},
		},
		rules: { 'graph/collect': 'error' },
	});
	const fatal = messages.find(message => message.fatal);
	if (fatal) throw new Error(`Failed to parse ${label}: ${fatal.message}`);
	return { staticSpecs, dynamicSpecs };
}

function resolveSpecifier(fromFileAbs, spec) {
	if (!spec.startsWith('.')) return { bare: spec };
	return { relPath: relToRepo(path.resolve(path.dirname(fromFileAbs), spec)) };
}

// Walk the static startup graph. Recurse only through src/*.js; vendor bundles
// and JSON catalogs are reachable leaves that are recorded but not parsed.
function staticClosure(entryRelPath) {
	const visited = new Set();
	const bareSpecs = new Set();
	const dynamicReached = new Set();

	const visit = relPath => {
		if (visited.has(relPath)) return;
		visited.add(relPath);
		if (!(relPath.startsWith('src/') && relPath.endsWith('.js'))) return;
		const abs = path.join(repoRoot, relPath);
		const { staticSpecs, dynamicSpecs } = collectSpecifiers(readFileSync(abs, 'utf8'), relPath);
		for (const spec of staticSpecs) {
			const resolved = resolveSpecifier(abs, spec);
			if (resolved.bare) bareSpecs.add(resolved.bare);
			else visit(resolved.relPath);
		}
		for (const spec of dynamicSpecs) {
			const resolved = resolveSpecifier(abs, spec);
			if (!resolved.bare) dynamicReached.add(resolved.relPath);
		}
	};

	visit(entryRelPath);
	return { visited, bareSpecs, dynamicReached };
}

function moduleScriptSrcs(htmlRelPath) {
	const html = readFileSync(path.join(repoRoot, htmlRelPath), 'utf8');
	const pattern = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/g;
	const srcs = [];
	let match;
	while ((match = pattern.exec(html)) !== null) srcs.push(toPosix(match[1]).replace(/^\.\//, ''));
	return srcs;
}

function htmlEntry(htmlRelPath) {
	const srcs = moduleScriptSrcs(htmlRelPath);
	expect(srcs, `${htmlRelPath} must declare exactly one <script type="module">`).toHaveLength(1);
	return srcs[0];
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
	const { visited, bareSpecs, dynamicReached } = staticClosure(entry);

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
