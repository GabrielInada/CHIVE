import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../eslint-rules/no-facade-getter-mutation.js';

// RuleTester drives test cases through describe/it; Vitest does not expose
// those as globals (tests import them), so wire them up explicitly.
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const FROM_APPSTATE = "import { getActiveDataset, getAllDatasets, getPanelBlocks, getState } from '../state/appState.js';";

ruleTester.run('no-facade-getter-mutation', rule, {
	valid: [
		// Inline read (no alias), never a mutation.
		`${FROM_APPSTATE}\nconst n = getActiveDataset().name;`,

		// Aliased but read-only.
		`${FROM_APPSTATE}\nconst d = getActiveDataset();\nconst n = d.name;\nconst c = d.chartConfig.color;`,

		// KEY false-positive lock: DOM HTMLElement.dataset writes are unrelated
		// to the facade alias and must not be flagged, even alongside a facade
		// read in the same module.
		`${FROM_APPSTATE}\nconst d = getActiveDataset();\nconst label = d.name;\nconst el = document.createElement('div');\nel.dataset.idx = '1';\nel.dataset.action = 'x';`,

		// Mutation of a non-facade local.
		`const obj = {};\nobj.x = 1;\nobj.items = [];`,

		// Import-gating lock: a DI-injected param named like a getter is NOT a
		// facade import, so mutating its (aliased) return is allowed.
		`function build(getChartSnapshot) {\n\tconst c = getChartSnapshot(1);\n\tc.title = 'x';\n}`,

		// Getter with a matching name but imported from an unrelated module.
		`import { getActiveDataset } from '../utils/helpers.js';\nconst d = getActiveDataset();\nd.x = 1;`,

		// Aliased getter, read-only.
		`${FROM_APPSTATE}\nconst s = getState();\nconst mode = s.ui.sidebarMode;`,

		// Passing the alias to a function is not a direct mutation (out of scope).
		`${FROM_APPSTATE}\nconst blocks = getPanelBlocks();\nrender(blocks);\nconst first = blocks[0];`,

		// The live-ref persistence snapshot getter, read-only.
		`import { getPersistenceSnapshot } from '../state/appState.js';\nconst s = getPersistenceSnapshot();\nconst n = s.ui.previewRows;`,
	],

	invalid: [
		// Aliased assignment, depth 1.
		{
			code: `${FROM_APPSTATE}\nconst d = getActiveDataset();\nd.chartConfig = {};`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// Aliased assignment, depth 2.
		{
			code: `${FROM_APPSTATE}\nconst d = getActiveDataset();\nd.chartConfig.color = 'red';`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// Computed assignment.
		{
			code: `${FROM_APPSTATE}\nconst d = getActiveDataset();\nd['chartConfig'] = {};`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// Update expression.
		{
			code: `${FROM_APPSTATE}\nconst d = getActiveDataset();\nd.count++;`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// delete.
		{
			code: `${FROM_APPSTATE}\nconst d = getActiveDataset();\ndelete d.chartConfig;`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// Mutating array method on the alias.
		{
			code: `${FROM_APPSTATE}\nconst all = getAllDatasets();\nall.push({});`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		{
			code: `${FROM_APPSTATE}\nconst all = getAllDatasets();\nall.splice(0, 1);`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// Object.assign(alias, …).
		{
			code: `${FROM_APPSTATE}\nconst d = getActiveDataset();\nObject.assign(d, { x: 1 });`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// Aliased getter, mutated via an in-place array method.
		{
			code: `${FROM_APPSTATE}\nconst blocks = getPanelBlocks();\nblocks.sort();`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// `as`-renamed import is still tracked by its local name.
		{
			code: `import { getState as gs } from '../state/appState.js';\nconst s = gs();\ns.ui = {};`,
			errors: [{ messageId: 'facadeMutation' }],
		},
		// The live-ref persistence snapshot getter, mutated through an alias.
		{
			code: `import { getPersistenceSnapshot } from '../state/appState.js';\nconst s = getPersistenceSnapshot();\ns.data.datasets.push({});`,
			errors: [{ messageId: 'facadeMutation' }],
		},
	],
});
