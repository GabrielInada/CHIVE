import js from '@eslint/js';
import chiveRules from './eslint-rules/index.js';

const STATELESS_RENDERER_MESSAGE =
	'Renderers and DOM builders (dataset workspace and panel feature views/dialogs, and the settings dialog) do not ' +
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

// One-way dependency direction between the composition layers and everything
// below them: entries compose app, app composes features/ui/state/services,
// features use ui/state/services, and ui/ is a strict leaf. The constants are
// shared because flat config REPLACES `no-restricted-imports` per file subset
// (see the (A) note), so several blocks must restate the same groups.
const COMPOSITION_LAYER_BAN = {
	group: ['**/entries/**', '**/app/**'],
	message: 'entries/ and app/ are composition layers and may not be imported by features/ or ui/.',
};

const PERSISTENCE_INTERNALS_BAN = {
	group: ['**/services/persistence/**'],
	message: 'Import persistence through services/persistence.js; the package internals are private.',
};

// `**/components/**` below is a legacy defensive ban: the directory is gone,
// the inert glob just keeps a resurrected src/components/ file from being
// imported by layers that never consumed it. Inert ban globs are harmless;
// only `files:` globs suffer silent-pass.
const UI_LAYER_BAN = {
	group: [
		'**/entries/**', '**/app/**', '**/charts/**', '**/components/**', '**/data/**',
		'**/domain/**', '**/features/**', '**/i18n/**', '**/icons/**', '**/services/**',
		'**/state/**', '**/styles/**', '**/workers/**',
	],
	message: 'ui/ contains ownerless browser UI mechanics. Import only ui/, config/, utils/, types.js, or vendored modules.',
};

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

	// (A2) Keep the browser entrypoints structural only. Application wiring,
	// scheduling, and debug construction belong to the explicit app modules.
	// Entries live in src/entries/, one level below src/, so sibling layers are
	// reached with ../ and vendor with ../../. `./**` bans one entry from
	// importing another; `../app/**` is the single allowed sibling (absent from
	// the group below).
	{
		files: ['src/entries/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: [
						'./**',
						'../charts/**',
						// Legacy defensive ban (src/components/ is gone; see UI_LAYER_BAN note).
						'../components/**',
						'../config/**',
						'../data/**',
						'../domain/**',
						'../features/**',
						'../i18n/**',
						'../services/**',
						'../state/**',
						'../styles/**',
						'../types.js',
						'../ui/**',
						'../utils/**',
						'../workers/**',
						'../../vendor/**',
					],
					message: 'src/entries/*.js import only from src/app/; keep application wiring out of the browser entrypoints.',
				}],
			}],
		},
	},

	// (A3) The persistence package is package-private: reach it through the
	// public `services/persistence.js` module, never its internals (lifecycle,
	// snapshot, autosave, backends, sqlite). Scoped to the layers that
	// legitimately consume services; utils/, config/, domain/, and the chart
	// packages already ban `services/**` wholesale in their own blocks below.
	// Deliberately placed before those narrower blocks: per the (A) note, a
	// later block matching the same file wins outright, so this must not sit
	// after them or it would drop their restrictions.
	// `workers/persistWorker.js` is the one legitimate internals importer, it
	// hosts the blob backend off the main thread, which is the point of the
	// worker.
	{
		files: [
			'src/app/**/*.js',
			'src/state/**/*.js',
			'src/workers/**/*.js',
		],
		ignores: ['src/workers/persistWorker.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [PERSISTENCE_INTERNALS_BAN],
			}],
		},
	},

	// (A4) Features sit below the composition layers: they may not import
	// entries/ or app/ (the audit's Priority 1 inversion), and like (A3) they
	// reach persistence only through its public module. Narrower feature blocks
	// below (B2, B2c, B2d) REPLACE this one for their files, so each restates
	// both bans.
	{
		files: ['src/features/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [PERSISTENCE_INTERNALS_BAN, COMPOSITION_LAYER_BAN],
			}],
		},
	},

	// (B2d) The settings dialog is stricter than the other feature dialogs: it
	// is callback-driven (values and change handlers arrive from the settings
	// controller), so ALL of state/ is banned rather than allowing the
	// read-only appState surface.
	{
		files: ['src/features/settings/settingsDialog.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [
					COMPOSITION_LAYER_BAN,
					PERSISTENCE_INTERNALS_BAN,
					{
						group: ['**/state/**'],
						message: 'The settings dialog is callback-driven: values and change handlers arrive from the controller. It imports no application state.',
					},
				],
			}],
		},
	},

	// (B2) Panel feature views, layout interactions, slot lifecycle, and export:
	// renderer statelessness (read-only facade imports only). The feature
	// controller is intentionally outside this list because it owns facade
	// writes and event subscriptions. State mutation internals remain under
	// `state/`. This block REPLACES (A4) for these files, so it restates the
	// persistence and composition bans.
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
				patterns: [
					PERSISTENCE_INTERNALS_BAN,
					COMPOSITION_LAYER_BAN,
					{
						group: ['**/state/appState.js'],
						allowImportNames: APP_STATE_READS,
						message: STATELESS_RENDERER_MESSAGE,
					},
				],
			}],
		},
	},

	// (B2b) Panel state mutation internals belong to the state core. Keep this
	// layer independent of presentation, feature, chart, and service code; the
	// public write surface remains `panelStateFacade.js`.
	{
		files: ['src/state/panel/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/components/**', '**/features/**', '**/services/**', '**/charts/**', '**/ui/**'],
					message: 'Panel state internals import only state, domain, config, utils, types, or vendor modules.',
				}],
			}],
		},
	},

	// (B2c) Dataset workspace feature views and dialogs: same renderer-
	// statelessness rule as (B2). The feature controller (datasetController.js)
	// and its bindings/ stay outside this list: the controller owns facade
	// writes and dataset workflow setup, and bindings translate DOM intent into
	// controller calls. statsView reads getActiveDataset, which is in the
	// read-only surface (APP_STATE_READS) allowed below. This block REPLACES
	// (A4) for these files, so it restates the persistence and composition bans.
	{
		files: [
			'src/features/datasetWorkspace/workspaceView.js',
			'src/features/datasetWorkspace/views/**/*.js',
			'src/features/datasetWorkspace/dialogs/**/*.js',
		],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [
					PERSISTENCE_INTERNALS_BAN,
					COMPOSITION_LAYER_BAN,
					{
						group: ['**/state/appState.js'],
						allowImportNames: APP_STATE_READS,
						message: STATELESS_RENDERER_MESSAGE,
					},
				],
			}],
		},
	},

	// (B3) Per-chart package leaf files (src/charts/<name>/): data, options,
	// color, scales, math, axis helpers, encoding, palettes, and regression
	// stay pure D3 math, interaction modules stay pure input/tooltip
	// mechanics, and renderers draw from explicit inputs only.
	// None of them may reach app/, state/, features/, components/, ui/, or
	// services/ (package-local and charts/shared modules, config, utils, and
	// vendor modules only). Localized strings arrive through options.labels; state
	// never enters a renderer.
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
					group: ['**/app/**', '**/state/**', '**/features/**', '**/components/**', '**/services/**', '**/ui/**'],
					message: 'Chart package leaf files import only package-local or charts/shared modules, config, utils, and vendor modules. Localized strings arrive via options.labels; state stays behind the section/adapter props.',
				}],
			}],
		},
	},

	// (B3a) Shared chart rendering infrastructure is reusable leaf code. It
	// may import vendor, config, utils, or other charts/shared modules, but it
	// never reaches application state, components, feature modules, or services.
	// listenerBindings.js is the reason state/ is banned by name: it wires
	// controls to config writes, but only through an injected writer, so the
	// write adapter itself stays in the dataset-workspace feature.
	{
		files: ['src/charts/shared/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/app/**', '**/state/**', '**/components/**', '**/features/**', '**/services/**', '**/ui/**'],
					message: 'Shared chart infrastructure is a leaf layer. Import only charts/shared, config, utils, or vendor modules. Chart-config writes arrive through an injected ChartConfigWriter, never a state import.',
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
					group: ['**/app/**', '**/state/**', '**/components/**', '**/features/**', '**/services/**', '**/ui/**'],
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
					group: ['**/components/**', '**/features/**', '**/services/**', '**/state/**', '**/ui/**'],
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
					group: ['**/features/**', '**/services/**', '**/state/**', '**/chartControls/**', '**/ui/**'],
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
					group: ['**/components/**', '**/features/**', '**/services/**', '**/state/**', '**/chartControls/**', '**/ui/**'],
					message: 'The panel registry imports only chart panel adapters and leaf config/types.',
				}],
			}],
		},
	},

	// (B4) Per-chart package integration files: sections/adapters receive
	// props and callbacks, never state; controls write through an injected
	// ChartConfigWriter, whose adapter lives in the dataset-workspace feature.
	// No panel internals and no workspace components (the container lifecycle
	// and chart-message helpers live in utils for exactly this reason).
	// services/ is deliberately NOT banned here: builders, sections, and
	// presentation legitimately import i18nService for their labels. That is the
	// line between (B3) leaf files, which take strings via options.labels, and
	// these integration files. Listeners are stricter still, see (B4a).
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
					group: ['**/app/**', '**/state/**', '**/features/**', '**/components/**', '**/ui/**'],
					message: 'Chart package integration files do not import app modules, state, panel internals, ui/ mechanics, or workspace components. Receive props/callbacks; controls write only through the injected ChartConfigWriter.',
				}],
			}],
		},
	},

	// (B4a) Control listeners are the strictest chart-package files: after the
	// writer injection they need no services at all, so i18n is banned here even
	// though (B4) allows it for builders and presentation. Placed AFTER (B4)
	// deliberately: per the (A) note, this config REPLACES (B4)'s for these files
	// rather than merging, so it must restate BARE_IMPORT_BANS and the full
	// pattern group. Omitting `paths` would silently hand listeners back the
	// right to use bare `d3`/`three` specifiers and break raw-static hosting.
	{
		files: ['src/charts/*/controls/listeners.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/app/**', '**/state/**', '**/features/**', '**/components/**', '**/services/**', '**/ui/**'],
					message: 'Chart control listeners are pure input mechanics: they read the DOM and write through the injected ChartConfigWriter. Import only package-local modules, charts/shared bindings, config, utils, and vendor modules. Labels belong to the builder.',
				}],
			}],
		},
	},

	// (C0) ui/ owns ownerless browser UI mechanics (feedback toasts, dialog
	// focus). It is a strict leaf apart from DOM access: no imports from any
	// owned layer, so a feature or app module can always depend on it without
	// dragging state, services, or another feature along.
	{
		files: ['src/ui/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [UI_LAYER_BAN],
			}],
		},
	},

	// (C) utils/ is a pure leaf layer — no imports from app/, state/, components/,
	// features/, services/, or ui/. (Formerly allowed services/ because formatters.js
	// imported i18n; that edge was removed when formatters became pure, closing
	// the boundary fully.)
	{
		files: ['src/utils/**/*.js'],
		rules: {
			'no-restricted-imports': ['error', {
				paths: BARE_IMPORT_BANS,
				patterns: [{
					group: ['**/app/**', '**/state/**', '**/components/**', '**/features/**', '**/services/**', '**/ui/**'],
					message: 'utils/ is a pure leaf layer — no imports from app/, state/, components/, features/, services/, or ui/.',
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
					group: ['**/app/**', '**/state/**', '**/components/**', '**/features/**', '**/services/**', '**/ui/**'],
					message: 'config/ is a pure leaf layer, no imports from app/, state/, components/, features/, services/, or ui/.',
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
					group: ['**/app/**', '**/state/**', '**/components/**', '**/features/**', '**/services/**', '**/charts/**', '**/ui/**'],
					message: 'domain/ is a pure leaf layer. Import only domain, config, utils, or vendor modules.',
				}],
			}],
		},
	},

	// (E) Aliased facade-getter mutation guard. Catches
	// `const d = getActiveDataset(); d.x = y`, the blind spot the inline
	// no-restricted-syntax selectors above can't reach. Scope-aware + import-
	// gated (see the rule banner; its FACADE_SOURCE_RE is path-shaped and must
	// track this scope). Facade internals under state/ legitimately use the
	// aliased-write pattern, so they are exempt.
	{
		files: ['src/**/*.js'],
		ignores: ['src/state/**'],
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
