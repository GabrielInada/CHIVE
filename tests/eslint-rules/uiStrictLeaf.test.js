import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rule from '../../eslint-rules/ui-strict-leaf.js';

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const filename = path.join(repoRoot, 'src/ui/probe.js');

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

ruleTester.run('ui-strict-leaf', rule, {
	valid: [
		{ filename, code: "import './dialogFocus.js';" },
		{ filename, code: "import '../config/elementIds.js';" },
		{ filename, code: "export * from '../utils/result.js';" },
		{ filename, code: "import('../types.js');" },
		{ filename, code: "import '../../vendor/d3/d3.js';" },
	],
	invalid: [
		{
			filename,
			code: "import '../futureLayer/example.js';",
			errors: [{ messageId: 'strictLeaf' }],
		},
		{
			filename,
			code: "export { value } from '../state/example.js';",
			errors: [{ messageId: 'strictLeaf' }],
		},
		{
			filename,
			code: "export * from '../../tests/setup/indexeddb.js';",
			errors: [{ messageId: 'strictLeaf' }],
		},
		{
			filename,
			code: "import('../services/example.js');",
			errors: [{ messageId: 'strictLeaf' }],
		},
		{
			filename,
			code: "import('node:fs');",
			errors: [{ messageId: 'strictLeaf' }],
		},
	],
});
