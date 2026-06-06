/**
 * @fileoverview Forbid mutating the return value of a CHIVE facade getter
 * through an alias, e.g. `const d = getActiveDataset(); d.x = y`.
 *
 * The inline form (`getActiveDataset().x = y`) is handled by the
 * `no-restricted-syntax` selectors in eslint.config.js; this rule covers the
 * aliased form, which needs scope analysis.
 *
 * The rule is deliberately BOTH scope-aware AND import-gated:
 *   - Scope-aware: it flags mutations only of the specific variable bound to a
 *     facade getter call, resolved via scope references. A name/AST matcher on
 *     `.dataset.*` / `.push(` would wrongly flag the many DOM
 *     `el.dataset.x = y` writes across the codebase.
 *   - Import-gated: the getter must be a named import from modules/index.js or
 *     modules/state/appState.js. Otherwise a DI-injected param named like a
 *     getter (e.g. panelStateMutations.js) would be misread as a facade getter.
 *
 * Keep TRACKED_GETTERS in sync with FACADE_MUTABLE_GETTERS in eslint.config.js.
 */

const TRACKED_GETTERS = new Set([
	'getActiveDataset',
	'getAllDatasets',
	'getPanelCharts',
	'getChartSnapshot',
	'getPanelBlocks',
	'getState',
	'getPersistenceSnapshot',
]);

// A getter only counts as a facade getter when imported from one of these.
const FACADE_SOURCE_RE = /(?:^|\/)modules\/(?:index|state\/appState)\.js$/;

const MUTATING_METHODS = new Set([
	'push', 'pop', 'shift', 'unshift', 'splice',
	'sort', 'reverse', 'fill', 'copyWithin',
]);

function isObjectAssign(callee) {
	return (
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		callee.object.type === 'Identifier' &&
		callee.object.name === 'Object' &&
		callee.property.type === 'Identifier' &&
		callee.property.name === 'assign'
	);
}

export default {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow mutating the return value of a CHIVE facade getter via an alias.',
		},
		schema: [],
		messages: {
			facadeMutation:
				'Mutating a facade getter return is forbidden, these are read-only views. ' +
				'Use the corresponding facade write method (updateActiveDatasetConfig, ' +
				'addChartSnapshot, …). See CONTRIBUTING.md §Architecture invariants.',
		},
	},

	create(context) {
		const sourceCode = context.sourceCode;
		const facadeGetterLocals = new Set();
		const facadeRefVariables = new Set();

		function report(node) {
			context.report({ node, messageId: 'facadeMutation' });
		}

		// Given an identifier reference to a facade-ref variable, report when the
		// surrounding expression mutates it (assign / update / delete / mutating
		// array method / Object.assign).
		function checkMemberMutation(idNode) {
			const parent = idNode.parent;
			if (!parent) return;

			// Object.assign(alias, …)
			if (
				parent.type === 'CallExpression' &&
				parent.arguments[0] === idNode &&
				isObjectAssign(parent.callee)
			) {
				report(parent);
				return;
			}

			if (parent.type !== 'MemberExpression' || parent.object !== idNode) return;

			// Climb the member chain rooted at the alias (alias.a.b…).
			let member = parent;
			while (
				member.parent.type === 'MemberExpression' &&
				member.parent.object === member
			) {
				member = member.parent;
			}
			const outer = member.parent;

			if (outer.type === 'AssignmentExpression' && outer.left === member) {
				report(outer);
			} else if (outer.type === 'UpdateExpression' && outer.argument === member) {
				report(outer);
			} else if (
				outer.type === 'UnaryExpression' &&
				outer.operator === 'delete' &&
				outer.argument === member
			) {
				report(outer);
			} else if (
				outer.type === 'CallExpression' &&
				outer.callee === member &&
				member.property.type === 'Identifier' &&
				MUTATING_METHODS.has(member.property.name)
			) {
				report(outer);
			}
		}

		return {
			// Collect facade-getter local names up front so VariableDeclarator
			// (visited later) always sees a complete set, regardless of import
			// position.
			Program(node) {
				for (const stmt of node.body) {
					if (stmt.type !== 'ImportDeclaration') continue;
					if (typeof stmt.source.value !== 'string') continue;
					if (!FACADE_SOURCE_RE.test(stmt.source.value)) continue;
					for (const spec of stmt.specifiers) {
						if (
							spec.type === 'ImportSpecifier' &&
							spec.imported.type === 'Identifier' &&
							TRACKED_GETTERS.has(spec.imported.name)
						) {
							facadeGetterLocals.add(spec.local.name);
						}
					}
				}
			},

			VariableDeclarator(node) {
				if (
					node.id.type === 'Identifier' &&
					node.init &&
					node.init.type === 'CallExpression' &&
					node.init.callee.type === 'Identifier' &&
					facadeGetterLocals.has(node.init.callee.name)
				) {
					for (const variable of sourceCode.getDeclaredVariables(node)) {
						facadeRefVariables.add(variable);
					}
				}
			},

			'Program:exit'() {
				for (const variable of facadeRefVariables) {
					for (const ref of variable.references) {
						checkMemberMutation(ref.identifier);
					}
				}
			},
		};
	},
};
