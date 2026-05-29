import js from '@eslint/js';
import chiveRules from './eslint-rules/index.js';

const STATELESS_RENDERER_MESSAGE =
	'Renderers (src/components/, src/features/) must be stateless ' +
	'(ARCHITECTURE.md §4). Only read-only facade members are importable here. ' +
	'Route writes through chartControls listeners or modules/eventHandlers.';

// Read-only facade surface that renderers may import from appState.js.
// If you add a new READ function to appState.js, add it here too. Anything
// not in this list is treated as a write and blocked.
const APP_STATE_READS = [
	'getActiveDataset',
	'getAllDatasets',
	'getPanelCharts',
	'getChartSnapshot',
	'getPanelBlocks',
	'getState',
	'onStateChange',
	'STATE_EVENTS',
	'sanitizeChartName',
];

// Facade getters that return mutable refs (objects/arrays). The inline mutation
// guard below blocks `getXxx().a.b = c` assignments across all of src/. The
// aliased form (`const d = getXxx(); d.a = b`) is caught separately by the
// local `chive/no-facade-getter-mutation` rule. If a new mutable-ref getter is
// added to appState.js, add it here too (and to the local rule's getter list).
const FACADE_MUTABLE_GETTERS = '(getActiveDataset|getAllDatasets|getPanelCharts|getChartSnapshot|getPanelBlocks|getState)';

const FACADE_MUTATION_MESSAGE =
	'Mutating a facade getter return is forbidden — these are read-only views. ' +
	'Use the corresponding facade write method (updateActiveDatasetConfig, ' +
	'addChartSnapshot, …). See CONTRIBUTING.md §Architecture invariants.';

// Inline facade-mutation selectors: catch `getXxx().a = b` at depths 1–3.
const FACADE_MUTATION_SELECTORS = [
	{
		selector: `AssignmentExpression[left.object.callee.name=/^${FACADE_MUTABLE_GETTERS}$/]`,
		message: FACADE_MUTATION_MESSAGE,
	},
	{
		selector: `AssignmentExpression[left.object.object.callee.name=/^${FACADE_MUTABLE_GETTERS}$/]`,
		message: FACADE_MUTATION_MESSAGE,
	},
	{
		selector: `AssignmentExpression[left.object.object.object.callee.name=/^${FACADE_MUTABLE_GETTERS}$/]`,
		message: FACADE_MUTATION_MESSAGE,
	},
];

// Raw-static deployment guards. CHIVE can be served raw from src/ with no build
// step, so bundler-only / Vite-only import forms must be hard errors — they
// pass dev/test/Vite but break when src/ is served directly.
const BARE_IMPORT_BANS = [
	{
		name: 'd3',
		message: 'Import the full CDN URL (https://esm.sh/d3@7.9.0). A bare "d3" specifier only resolves under a bundler and breaks raw-static hosting.',
	},
	{
		name: 'banana-i18n',
		message: 'Import the full CDN URL (https://esm.sh/banana-i18n@2.4.0). A bare specifier only resolves under a bundler and breaks raw-static hosting.',
	},
];

const VITE_ONLY_SYNTAX_SELECTORS = [
	{
		selector: ':matches(ImportDeclaration, ImportExpression, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/\\?(worker|url|raw)(&|$)/]',
		message: 'Vite-only import suffix (?worker / ?url / ?raw) breaks raw-static hosting. Build workers with `new Worker(new URL(...), import.meta.url)` instead.',
	},
	{
		selector: "MemberExpression[object.type='MetaProperty'][property.name=/^(glob|env)$/]",
		message: 'import.meta.glob / import.meta.env are Vite-only and break raw-static hosting. (import.meta.url is allowed — it is the standard worker/asset URL form.)',
	},
];

// Hand-maintained (dep-free, by choice — see ARCHITECTURE.md's minimal-footprint
// stance). Combined window + Web Worker scope, since the ingest worker is linted
// too. Add a global the first time a new browser/worker API is referenced in
// src/; the set below is exactly what src/ uses today.
const BROWSER_GLOBALS = {
	window: 'readonly',
	document: 'readonly',
	console: 'readonly',
	URL: 'readonly',
	localStorage: 'readonly',
	crypto: 'readonly',
	fetch: 'readonly',
	setTimeout: 'readonly',
	clearTimeout: 'readonly',
	requestAnimationFrame: 'readonly',
	structuredClone: 'readonly',
	indexedDB: 'readonly',
	Node: 'readonly',
	HTMLElement: 'readonly',
	HTMLInputElement: 'readonly',
	CustomEvent: 'readonly',
	XMLSerializer: 'readonly',
	AbortController: 'readonly',
	AbortSignal: 'readonly',
	ResizeObserver: 'readonly',
	FileReader: 'readonly',
	Blob: 'readonly',
	Worker: 'readonly',
	self: 'readonly',
	DedicatedWorkerGlobalScope: 'readonly',
};

export default [
	js.configs.recommended,

	// (A) src-wide defaults: language options + cross-cutting guards applied to
	// ALL of src/. NOTE: flat config REPLACES (does not merge) a rule's options
	// across matching config objects — the last match wins entirely. The blocks
	// below redeclare `no-restricted-imports` for their file subset, so each one
	// must repeat BARE_IMPORT_BANS or it would silently drop the bare-import
	// guard for those files. Likewise, all `no-restricted-syntax` selectors for
	// src/ must live here in one array.
	{
		files: ['src/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: BROWSER_GLOBALS,
		},
		rules: {
			'no-restricted-imports': ['error', { paths: BARE_IMPORT_BANS }],
			'no-restricted-syntax': ['error',
				...FACADE_MUTATION_SELECTORS,
				...VITE_ONLY_SYNTAX_SELECTORS,
			],
			// General JS hygiene as non-blocking warnings (CI runs `npm run lint`
			// with no --max-warnings, so these don't gate merges). See
			// CONTRIBUTING.md §ESLint guards. `curly` uses 'multi-line' to match
			// the codebase's brace-free single-line style (the default 'all'
			// would flag ~500 existing statements).
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'prefer-const': 'warn',
			'no-var': 'warn',
			'eqeqeq': 'warn',
			'curly': ['warn', 'multi-line'],
			'no-undef': 'error',
		},
	},

	// (B) Renderers must be stateless: only read-only facade imports. Placed
	// AFTER (A) because it redeclares `no-restricted-imports`; it repeats the
	// bare-import bans alongside the facade-read restriction.
	{
		files: ['src/components/**/*.js', 'src/features/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/modules/state/appState.js'],
					allowImportNames: APP_STATE_READS,
					message: STATELESS_RENDERER_MESSAGE,
				}],
			}],
		},
	},

	// (C) utils/ is a pure leaf layer — no imports from modules/, components/,
	// features/, or services/. (Formerly allowed services/ because formatters.js
	// imported i18n; that edge was removed when formatters became pure, closing
	// the boundary fully.)
	{
		files: ['src/utils/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/modules/**', '**/components/**', '**/features/**', '**/services/**'],
					message: 'utils/ is a pure leaf layer — no imports from modules/, components/, features/, or services/.',
				}],
			}],
		},
	},

	// (D) config/ is a pure leaf layer — no imports from any higher layer.
	{
		files: ['src/config/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/modules/**', '**/components/**', '**/features/**', '**/services/**'],
					message: 'config/ is a pure leaf layer — no imports from modules/, components/, features/, or services/.',
				}],
			}],
		},
	},

	// (E) Aliased facade-getter mutation guard. Catches
	// `const d = getActiveDataset(); d.x = y` — the blind spot the inline
	// no-restricted-syntax selectors above can't reach. Scope-aware + import-
	// gated (see the rule banner). Facade internals under state/ legitimately
	// use the aliased-write pattern, so they are exempt.
	{
		files: ['src/**/*.js'],
		ignores: ['src/modules/state/**'],
		plugins: { chive: chiveRules },
		rules: {
			'chive/no-facade-getter-mutation': 'error',
		},
	},
];
