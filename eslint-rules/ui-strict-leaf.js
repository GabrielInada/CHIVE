/**
 * @fileoverview Keep src/ui as a strict leaf by resolving relative import
 * targets against the file being linted.
 *
 * This rule is path-shaped. If src/ui moves, update the allowed roots here and
 * the boundary probes that protect this rule from silently matching the wrong
 * paths.
 */

import path from 'node:path';

const MESSAGE =
	'ui/ contains ownerless browser UI mechanics. Import only ui/, config/, utils/, types.js, or vendored modules.';

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
				'Restrict src/ui imports to ui, config, utils, shared types, and vendored modules.',
		},
		schema: [],
		messages: {
			strictLeaf: MESSAGE,
		},
	},

	create(context) {
		const repoRoot = normalizeAbsolute(context.cwd);
		const allowedDirectories = [
			normalizeAbsolute(path.join(repoRoot, 'src/ui')),
			normalizeAbsolute(path.join(repoRoot, 'src/config')),
			normalizeAbsolute(path.join(repoRoot, 'src/utils')),
			normalizeAbsolute(path.join(repoRoot, 'vendor')),
		];
		const sharedTypesFile = normalizeAbsolute(path.join(repoRoot, 'src/types.js'));
		const sourceDirectory = path.dirname(context.filename);

		function reportIfRestricted(sourceNode) {
			if (!sourceNode || typeof sourceNode.value !== 'string') return;

			const specifier = sourceNode.value;
			if (!specifier.startsWith('.')) {
				context.report({ node: sourceNode, messageId: 'strictLeaf' });
				return;
			}

			const target = normalizeAbsolute(path.resolve(sourceDirectory, specifier));
			const allowed =
				target === sharedTypesFile ||
				allowedDirectories.some(directory => isInside(target, directory));

			if (!allowed) context.report({ node: sourceNode, messageId: 'strictLeaf' });
		}

		return {
			ImportDeclaration: node => reportIfRestricted(node.source),
			ExportNamedDeclaration: node => reportIfRestricted(node.source),
			ExportAllDeclaration: node => reportIfRestricted(node.source),
			ImportExpression: node => reportIfRestricted(node.source),
		};
	},
};
