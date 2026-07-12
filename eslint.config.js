import js from '@eslint/js';
import chiveRules from './eslint-rules/index.js';

const STATELESS_RENDERER_MESSAGE =
	'Renderers and DOM builders (src/components/ and panel feature presentation files) do not ' +
	'call write facades (docs/development/architecture.md Layers section). Only read-only facade members ' +
	'are importable here. Route writes through feature controllers, ' +
	'chart-control listeners, or event-handler modules.';

// Renderer-safe read surface that renderers may import from appState.js.
// Add a new read here only when renderers should use it; reads meant for
// persistence, debug, or internal use (e.g. getPersistenceSnapshot) are
// deliberately absent. Anything not in this list is treated as a write and
// blocked.
const APP_STATE_READS = [
	'getActiveDataset',
	'getActiveDatasetIndex',
	'getPreviewRows',
	'getAllDatasets',
	'getPanelCharts',
	'getChartSnapshot',
	'getPanelBlocks',
	'getState',
	'onStateChange',
	'STATE_EVENTS',
	'sanitizeChartName',
];

// Object- and array-returning read facades whose results must be treated
// read-only (getState returns a clone, but its result is still not a legal
// write target). The inline mutation guard below blocks `getXxx().a.b = c`
// assignments AND inline mutating-method calls (`getXxx().a.push(...)`)
// across all of src/. The aliased form (`const d = getXxx(); d.a = b`) is
// caught separately by the local `chive/no-facade-getter-mutation` rule. If a
// new object- or array-returning read facade is added to appState.js, add it
// here too (and to the local rule's getter list).
const FACADE_MUTABLE_GETTERS = '(getActiveDataset|getAllDatasets|getPanelCharts|getChartSnapshot|getPanelBlocks|getState|getPersistenceSnapshot)';

// Array methods that mutate the receiver in place. Kept in sync with
// MUTATING_METHODS in eslint-rules/no-facade-getter-mutation.js.
const FACADE_MUTATING_METHODS = '(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)';

const FACADE_MUTATION_MESSAGE =
	'Mutating a facade getter return is forbidden, these are read-only views. ' +
	'Use the corresponding facade write method (updateActiveDatasetConfig, ' +
	'addChartSnapshot, …). See CONTRIBUTING.md §Architecture invariants.';

// Inline facade-mutation selectors: catch `getXxx().a = b` (assignment) and
// `getXxx().a.push(...)` (mutating method call) at depths 1 to 3. A direct
// `getXxx().push(...)` is depth 1 (the getter call is the method's `.object`).
// Mutating methods chained off a copy (`getXxx().slice().sort()`) are not
// matched because the method's `.object` is the `slice()` call, not the getter.
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
	{
		selector: `CallExpression[callee.property.name=/^${FACADE_MUTATING_METHODS}$/][callee.object.callee.name=/^${FACADE_MUTABLE_GETTERS}$/]`,
		message: FACADE_MUTATION_MESSAGE,
	},
	{
		selector: `CallExpression[callee.property.name=/^${FACADE_MUTATING_METHODS}$/][callee.object.object.callee.name=/^${FACADE_MUTABLE_GETTERS}$/]`,
		message: FACADE_MUTATION_MESSAGE,
	},
	{
		selector: `CallExpression[callee.property.name=/^${FACADE_MUTATING_METHODS}$/][callee.object.object.object.callee.name=/^${FACADE_MUTABLE_GETTERS}$/]`,
		message: FACADE_MUTATION_MESSAGE,
	},
];

// Raw-static deployment guards. CHIVE can be served raw from src/ with no build
// step, so bundler-only / Vite-only import forms must be hard errors, they
// pass dev/test/Vite but break when src/ is served directly.
const BARE_IMPORT_BANS = [
	{
		name: 'd3',
		message: 'Import the checked-in vendor module (`vendor/d3/d3.js`) via a relative path. A bare "d3" specifier only resolves under a bundler and breaks raw-static hosting.',
	},
	{
		name: 'banana-i18n',
		message: 'Import the checked-in vendor module (`vendor/banana-i18n/banana-i18n.js`) via a relative path. A bare specifier only resolves under a bundler and breaks raw-static hosting.',
	},
	{
		name: 'three',
		message: 'Import the checked-in vendor module (`vendor/three/three.module.js`) via a relative path. A bare "three" specifier only resolves under a bundler and breaks raw-static hosting.',
	},
];

const VITE_ONLY_SYNTAX_SELECTORS = [
	{
		selector: ':matches(ImportDeclaration, ImportExpression, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^https:\\/\\/esm\\.sh\\//]',
		message: 'Runtime JavaScript dependencies must load from checked-in vendor modules, not esm.sh.',
	},
	{
		selector: ':matches(ImportDeclaration, ImportExpression, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/\\?(worker|url|raw)(&|$)/]',
		message: 'Vite-only import suffix (?worker / ?url / ?raw) breaks raw-static hosting. Build workers with `new Worker(new URL(...), import.meta.url)` instead.',
	},
	{
		selector: "MemberExpression[object.type='MetaProperty'][property.name=/^(glob|env)$/]",
		message: 'import.meta.glob / import.meta.env are Vite-only and break raw-static hosting. (import.meta.url is allowed, it is the standard worker/asset URL form.)',
	},
];

// Hand-maintained (dep-free, by choice, see docs/development/architecture.md's minimal-footprint
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
	globalThis: 'readonly',
	TextEncoder: 'readonly',
	ArrayBuffer: 'readonly',
	Uint8Array: 'readonly',
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

const TEST_GLOBALS = {
	...BROWSER_GLOBALS,
	global: 'readonly',
	File: 'readonly',
	Event: 'readonly',
	MouseEvent: 'readonly',
	KeyboardEvent: 'readonly',
	Option: 'readonly',
	queueMicrotask: 'readonly',
	DOMException: 'readonly',
	HTMLAnchorElement: 'readonly',
	// Canvas-chart interaction tests dispatch wheel/pointer events.
	WheelEvent: 'readonly',
	PointerEvent: 'readonly',
	// Settings-service tests stub Storage.prototype to simulate blocked storage.
	Storage: 'readonly',
};

export default [
	js.configs.recommended,

	// (A) src-wide defaults: language options + cross-cutting guards applied to
	// ALL of src/. NOTE: flat config REPLACES (does not merge) a rule's options
	// across matching config objects, the last match wins entirely. The blocks
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

	// (A2) Keep the browser entrypoint structural only. Application wiring,
	// scheduling, and debug construction belong to the explicit app modules.
	{
		files: ['src/main.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: [
						'./charts/**',
						'./components/**',
						'./config/**',
						'./data/**',
						'./domain/**',
						'./features/**',
						'./i18n/**',
						'./modules/**',
						'./services/**',
						'./styles/**',
						'./types.js',
						'./utils/**',
						'./workers/**',
						'../vendor/**',
					],
					message: 'src/main.js imports only from src/app/; keep application wiring out of the browser entrypoint.',
				}],
			}],
		},
	},

	// (B) Renderers must be stateless: only read-only facade imports. Placed
	// AFTER (A) because it redeclares `no-restricted-imports`; it repeats the
	// bare-import bans alongside the facade-read restriction.
	{
		files: ['src/components/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/state/appState.js'],
					allowImportNames: APP_STATE_READS,
					message: STATELESS_RENDERER_MESSAGE,
				}],
			}],
		},
	},

	// (B2) Panel feature views, layout interactions, slot lifecycle, and export:
	// same renderer-statelessness rule as (B). The feature controller is
	// intentionally outside this list because it owns facade writes and event
	// subscriptions. State mutation internals remain under `modules/state/`.
	{
		files: [
			'src/features/panel/views/**/*.js',
			'src/features/panel/layout/**/*.js',
			'src/features/panel/slots/**/*.js',
			'src/features/panel/export/**/*.js',
		],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/state/appState.js'],
					allowImportNames: APP_STATE_READS,
					message: STATELESS_RENDERER_MESSAGE,
				}],
			}],
		},
	},

	// (B2b) Panel state mutation internals belong to the state core. Keep this
	// layer independent of presentation, feature, chart, and service code; the
	// public write surface remains `panelStateFacade.js`.
	{
		files: ['src/modules/state/panel/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/components/**', '**/features/**', '**/services/**', '**/charts/**'],
					message: 'Panel state internals import only state, domain, config, utils, types, or vendor modules.',
				}],
			}],
		},
	},

	// (B3) Per-chart package leaf files (src/charts/<name>/): data, options,
	// color, scales, math, axis helpers, encoding, palettes, and regression
	// stay pure D3 math, interaction modules stay pure input/tooltip
	// mechanics, and renderers draw from explicit inputs only.
	// None of them may reach modules/, components/, or services/ (package-local
	// and charts/shared modules, config, utils, and vendor modules only).
	// Localized strings arrive through options.labels; state never enters a
	// renderer.
	{
		files: [
			'src/charts/*/data.js',
			'src/charts/*/options.js',
			'src/charts/*/color.js',
			'src/charts/*/scales.js',
			'src/charts/*/math.js',
			'src/charts/*/axisHelpers.js',
			'src/charts/*/encoding.js',
			'src/charts/*/palettes.js',
			'src/charts/*/regression.js',
			'src/charts/*/regressionLayer.js',
			'src/charts/*/interaction.js',
			'src/charts/*/interactions.js',
			'src/charts/*/renderers/**/*.js',
		],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/modules/**', '**/components/**', '**/services/**'],
					message: 'Chart package leaf files import only package-local or charts/shared modules, config, utils, and vendor modules. Localized strings arrive via options.labels; state stays behind the section/adapter props.',
				}],
			}],
		},
	},

	// (B3a) Shared chart rendering infrastructure is reusable leaf code. It
	// may import vendor, config, utils, or other charts/shared modules, but it
	// never reaches application state, components, feature modules, or services.
	{
		files: ['src/charts/shared/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/modules/**', '**/components/**', '**/features/**', '**/services/**'],
					message: 'Shared chart infrastructure is a leaf layer. Import only charts/shared, config, utils, or vendor modules.',
				}],
			}],
		},
	},

	// (B3b) The chart catalog is presentation metadata, not an integration
	// registry. Keep it and its static preview markup independent of feature
	// modules, workspace components, and services so importing chart metadata
	// cannot pull state or side-effecting code into a consumer.
	{
		files: ['src/charts/catalog.js', 'src/charts/previews.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/modules/**', '**/components/**', '**/features/**', '**/services/**'],
					message: 'Chart presentation metadata imports only static chart metadata, config, utils, or vendor modules.',
				}],
			}],
		},
	},

	// (B3c) Each chart integration registry owns exactly one surface. Keep the
	// three import graphs separate so adding a chart renderer cannot pull control
	// writers into workspace or panel rendering.
	{
		files: ['src/charts/registries/controls.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: [
					...BARE_IMPORT_BANS,
					{ name: './workspace.js', message: 'The controls registry cannot import the workspace registry.' },
					{ name: './panel.js', message: 'The controls registry cannot import the panel registry.' },
				],
				patterns: [{
					group: ['**/components/**', '**/features/**', '**/services/**', '**/state/**'],
					message: 'The controls registry imports only chart controls implementations and leaf config/types.',
				}],
			}],
		},
	},
	{
		files: ['src/charts/registries/workspace.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: [
					...BARE_IMPORT_BANS,
					{ name: './controls.js', message: 'The workspace registry cannot import the controls registry.' },
					{ name: './panel.js', message: 'The workspace registry cannot import the panel registry.' },
				],
				patterns: [{
					group: ['**/features/**', '**/services/**', '**/state/**', '**/chartControls/**'],
					message: 'The workspace registry imports only chart workspace sections and leaf config/types.',
				}],
			}],
		},
	},
	{
		files: ['src/charts/registries/panel.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: [
					...BARE_IMPORT_BANS,
					{ name: './controls.js', message: 'The panel registry cannot import the controls registry.' },
					{ name: './workspace.js', message: 'The panel registry cannot import the workspace registry.' },
				],
				patterns: [{
					group: ['**/components/**', '**/features/**', '**/services/**', '**/state/**', '**/chartControls/**'],
					message: 'The panel registry imports only chart panel adapters and leaf config/types.',
				}],
			}],
		},
	},

	// (B4) Per-chart package integration files: sections/adapters receive
	// props and callbacks, never state; controls write through the shared
	// chartControls helpers, which remain the config-write adapter. No
	// panel internals and no workspace components (the container lifecycle
	// and chart-message helpers live in utils for exactly this reason).
	{
		files: [
			'src/charts/*/workspaceSection.js',
			'src/charts/*/panelAdapter.js',
			'src/charts/*/presentation.js',
			'src/charts/*/controls/**/*.js',
		],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/state/appState.js', '**/modules/state/**', '**/features/**', '**/components/**'],
					message: 'Chart package integration files do not import state, panel internals, or workspace components. Receive props/callbacks; controls write only through the shared chartControls helpers.',
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

	// (D) config/ is a pure leaf layer, no imports from any higher layer.
	{
		files: ['src/config/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/modules/**', '**/components/**', '**/features/**', '**/services/**'],
					message: 'config/ is a pure leaf layer, no imports from modules/, components/, features/, or services/.',
				}],
			}],
		},
	},

	// (D2) domain/ holds pure product rules (panel layout templates, block
	// model). It is a leaf layer like utils/ and config/, and additionally
	// never imports chart presentation code: domain rules must stay usable
	// from state validation, rendering, and export without dragging DOM or
	// side effects along.
	{
		files: ['src/domain/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/modules/**', '**/components/**', '**/features/**', '**/services/**', '**/charts/**'],
					message: 'domain/ is a pure leaf layer. Import only domain, config, utils, or vendor modules.',
				}],
			}],
		},
	},

	// (E) Aliased facade-getter mutation guard. Catches
	// `const d = getActiveDataset(); d.x = y`, the blind spot the inline
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

	// (F) Tests run under Vitest/jsdom. Keep them in `npm run lint` without
	// applying src architecture guards to test harness code.
	{
		files: ['tests/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: TEST_GLOBALS,
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'prefer-const': 'warn',
			'no-var': 'warn',
			'eqeqeq': 'warn',
			'curly': ['warn', 'multi-line'],
			'no-undef': 'error',
		},
	},
];
