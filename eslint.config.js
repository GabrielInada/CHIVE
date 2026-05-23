import js from '@eslint/js';

const STATELESS_RENDERER_MESSAGE =
	'Renderers (src/components/, src/features/) must be stateless ' +
	'(ARCHITECTURE.md §4). Only read-only facade members are importable here. ' +
	'Route writes through chart-controls listeners or modules/eventHandlers.';

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

// Facade getters that return mutable refs (objects/arrays). The mutation guard
// below blocks inline `getXxx().a.b = c` assignments across all of src/. If a
// new mutable-ref getter is added to appState.js, add it here too.
const FACADE_MUTABLE_GETTERS = '(getActiveDataset|getAllDatasets|getPanelCharts|getChartSnapshot|getPanelBlocks|getState)';

const FACADE_MUTATION_MESSAGE =
	'Mutating a facade getter return is forbidden — these are read-only views. ' +
	'Use the corresponding facade write method (updateActiveDatasetConfig, ' +
	'addChartSnapshot, …). See CONTRIBUTING.md §Architecture invariants.';

export default [
	js.configs.recommended,
	{
		files: ['src/components/**/*.js', 'src/features/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				window: 'readonly',
				document: 'readonly',
				console: 'readonly',
			},
		},
		rules: {
			'no-restricted-imports': ['error', {
				patterns: [{
					group: ['**/modules/appState.js'],
					allowImportNames: APP_STATE_READS,
					message: STATELESS_RENDERER_MESSAGE,
				}],
			}],
			// Disable recommended rules that aren't the point of this lint setup.
			// The scope here is specifically the facade boundary; adding general
			// JS rules is its own decision.
			'no-unused-vars': 'off',
			'no-undef': 'off',
		},
	},
	{
		// Block 2: AST-level mutation guard across all of src/. Catches inline
		// `getActiveDataset().X = y` patterns (depth 1, 2, 3). The aliased form
		// `const ds = getActiveDataset(); ds.X = y` is NOT caught (static
		// analysis without scope tracking can't trace the alias) — that gap is
		// also what protects facade internals like dataStateFacade.js from
		// false positives, since they use exactly that aliased pattern.
		files: ['src/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				window: 'readonly',
				document: 'readonly',
				console: 'readonly',
			},
		},
		rules: {
			'no-restricted-syntax': ['error',
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
			],
			'no-unused-vars': 'off',
			'no-undef': 'off',
		},
	},
];
