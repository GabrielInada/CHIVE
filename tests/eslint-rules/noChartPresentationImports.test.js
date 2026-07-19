import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rule from '../../eslint-rules/no-chart-presentation-imports.js';

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const domainFilename = path.join(repoRoot, 'src/domain/charts/chartConfig.js');
const configFilename = path.join(repoRoot, 'src/config/charts/definitions/bar.js');

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

ruleTester.run('no-chart-presentation-imports', rule, {
	valid: [
		{ filename: domainFilename, code: "import '../../config/charts/defaults.js';" },
		{ filename: configFilename, code: "import './line.js';" },
		{ filename: configFilename, code: "export * from '../../../domain/filters/globalFilter.js';" },
	],
	invalid: [
		{
			filename: domainFilename,
			code: "import '../../charts/bar/data.js';",
			errors: [{ messageId: 'chartPresentation' }],
		},
		{
			filename: configFilename,
			code: "export { renderBar } from '../../../charts/bar/renderers/svg.js';",
			errors: [{ messageId: 'chartPresentation' }],
		},
		{
			filename: configFilename,
			code: "export * from '../../../charts/bar/controls.js';",
			errors: [{ messageId: 'chartPresentation' }],
		},
		{
			filename: configFilename,
			code: "import('../../../charts/bar/presentation.js');",
			errors: [{ messageId: 'chartPresentation' }],
		},
	],
});
