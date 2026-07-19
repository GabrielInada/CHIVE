/**
 * @fileoverview Keep pure src/domain modules from importing the chart
 * presentation layer while allowing the domain/charts owner directory.
 *
 * This rule is path-shaped. If src/domain or src/charts moves, update the
 * resolved roots here and the boundary probe that protects the rule from
 * silently matching the wrong paths.
 */

import path from 'node:path';

const MESSAGE =
	'domain/ is a pure leaf layer and may not import chart presentation code from src/charts/.';

function normalizeAbsolute(value) {
	return path.resolve(value).replaceAll('\\', '/');
}

function isInside(target, directory) {
	return target === directory || target.startsWith(`${directory}/`);
}

export default {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Prevent src/domain modules from importing the src/charts presentation layer.',
		},
		schema: [],
		messages: {
			chartPresentation: MESSAGE,
		},
	},

	create(context) {
		const repoRoot = normalizeAbsolute(context.cwd);
		const chartPresentationRoot = normalizeAbsolute(path.join(repoRoot, 'src/charts'));
		const sourceDirectory = path.dirname(context.filename);

		function reportIfChartPresentation(sourceNode) {
			if (!sourceNode || typeof sourceNode.value !== 'string') return;

			const specifier = sourceNode.value;
			if (!specifier.startsWith('.')) return;

			const target = normalizeAbsolute(path.resolve(sourceDirectory, specifier));
			if (isInside(target, chartPresentationRoot)) {
				context.report({ node: sourceNode, messageId: 'chartPresentation' });
			}
		}

		return {
			ImportDeclaration: node => reportIfChartPresentation(node.source),
			ExportNamedDeclaration: node => reportIfChartPresentation(node.source),
			ExportAllDeclaration: node => reportIfChartPresentation(node.source),
			ImportExpression: node => reportIfChartPresentation(node.source),
		};
	},
};
