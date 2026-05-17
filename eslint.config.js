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
	'getActiveDatasetIndex',
	'getPanelCharts',
	'getChartSnapshot',
	'getPanelSlots',
	'getPanelBlocks',
	'getPanelLayout',
	'getSidebarMode',
	'getExpandedCharts',
	'getPreviewRows',
	'getState',
	'onStateChange',
	'STATE_EVENTS',
	'sanitizeChartName',
];

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
];
