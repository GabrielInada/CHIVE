import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

/**
 * Permanent guard for the eslint.config.js layer boundaries.
 *
 * Flat config REPLACES `no-restricted-imports` outright for every matching
 * config object, so a later block that forgets to restate a pattern group
 * silently drops that boundary for its file subset, and `npm run lint` stays
 * green. The probes below lint virtual files (via lintText with a filePath
 * inside the layer under test) against the real config. Every src block that
 * declares no-restricted-imports has at least one probe, without claiming to
 * exercise every member of every pattern group.
 *
 * Probes use side-effect imports so no-unused-vars noise cannot appear. The
 * two APP_STATE_READS probes necessarily use a named import (the restriction
 * is name-based); their unused-var hit is a warning and does not affect
 * errorCount.
 */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Absolute virtual paths so the flat-config `files:` globs match regardless
// of the cwd vitest runs from.
const abs = relPath => path.join(repoRoot, relPath);

const eslint = new ESLint({ cwd: repoRoot });

async function lintProbe(virtualFile, code) {
	const [result] = await eslint.lintText(code, { filePath: abs(virtualFile) });
	return result;
}

const messagesForRule = (result, ruleId) =>
	result.messages.filter(message => message.ruleId === ruleId);

const strictUiMessages = result =>
	messagesForRule(result, 'chive/ui-strict-leaf');

const restrictionMessages = result =>
	result.messages.filter(message =>
		message.ruleId === 'no-restricted-imports' ||
		message.ruleId === 'chive/no-chart-presentation-imports' ||
		message.ruleId === 'chive/ui-strict-leaf' ||
		message.ruleId === 'no-restricted-globals');

// [virtual file, source text, boundary the probe proves, expected rule id]
const FORBIDDEN_IMPORTS = [
	['src/services/probe.js', "import 'lodash';", 'base src block bans unlisted bare specifiers'],
	['src/app/probe.js', "import '../services/persistence/lifecycle.js';", 'A3 bans persistence internals from app'],
	['src/state/probe.js', "import '../services/persistence/lifecycle.js';", 'A3 bans persistence internals from state'],
	['src/workers/ingestWorker.js', "import '../services/persistence/lifecycle.js';", 'A3 bans persistence internals from workers'],
	['src/features/datasetWorkspace/datasetController.js', "import '../../app/feedbackUI.js';", 'features block bans app/'],
	['src/features/datasetWorkspace/datasetController.js', "import '../../entries/app.js';", 'features block bans entries/'],
	['src/features/datasetWorkspace/datasetController.js', "import '../../services/persistence/lifecycle.js';", 'features block bans persistence internals'],
	['src/features/datasetWorkspace/dialogs/globalFilterDialog.js', "import '../../../app/nativeDialog.js';", 'B2c restated the composition ban'],
	['src/features/datasetWorkspace/dialogs/globalFilterDialog.js', "import '../../../services/persistence/lifecycle.js';", 'B2c restated the persistence ban'],
	['src/features/panel/views/probe.js', "import '../../../app/renderCoordinator.js';", 'B2 restated the composition ban'],
	['src/features/panel/views/probe.js', "import '../../../services/persistence/lifecycle.js';", 'B2 restated the persistence ban'],
	['src/features/panel/views/probe.js', "import { setSidebarMode } from '../../../state/appState.js';", 'B2 kept the APP_STATE_READS restriction'],
	['src/features/datasetWorkspace/dialogs/globalFilterDialog.js', "import { setSidebarMode } from '../../../state/appState.js';", 'B2c kept the APP_STATE_READS restriction'],
	['src/features/settings/settingsDialog.js', "import '../../state/appState.js';", 'B2d bans all of state/'],
	['src/features/settings/settingsDialog.js', "import '../../app/renderCoordinator.js';", 'B2d restated the composition ban'],
	['src/features/settings/settingsDialog.js', "import '../../services/persistence/lifecycle.js';", 'B2d restated the persistence ban'],
	['src/ui/feedback.js', "import '../app/renderCoordinator.js';", 'ui block bans app/'],
	['src/ui/feedback.js', "import '../entries/app.js';", 'ui block bans entries/'],
	['src/ui/feedback.js', "import '../state/appState.js';", 'ui block bans state/'],
	['src/ui/feedback.js', "import '../services/persistence/lifecycle.js';", 'ui block bans services/ including internals'],
	['src/ui/feedback.js', "import 'node:fs';", 'ui block restated the non-relative specifier ban'],
	['src/entries/about.js', "import '../ui/nativeDialog.js';", 'entries cannot import ui/'],
	['src/utils/probe.js', "import '../ui/feedback.js';", 'utils bans ui/'],
	['src/utils/probe.js', "import '../domain/filters/globalFilter.js';", 'utils bans domain/'],
	['src/utils/probe.js', "import '../charts/shared/containerLifecycle.js';", 'utils bans charts/'],
	[
		'src/utils/probe.js',
		'export function probe() { return document.title; }',
		'utils is DOM-free',
		'no-restricted-globals',
	],
	['src/config/probe.js', "import '../ui/feedback.js';", 'config bans ui/'],
	[
		'src/config/charts/definitions/bar.js',
		"import '../../../state/appState.js';",
		'config definitions keep the config leaf boundary',
	],
	['src/domain/panel/probe.js', "import '../../ui/feedback.js';", 'domain bans ui/'],
	[
		'src/domain/charts/chartConfig.js',
		"import '../../charts/bar/data.js';",
		'domain/charts bans chart presentation code',
		'chive/no-chart-presentation-imports',
	],
	[
		'src/config/charts/definitions/bar.js',
		"import '../../../charts/bar/renderers/svg.js';",
		'config/charts bans chart presentation code',
		'chive/no-chart-presentation-imports',
	],
	[
		'src/domain/panel/probe.js',
		'export function probe() { return document.title; }',
		'domain is DOM-free',
		'no-restricted-globals',
	],
	['src/state/panel/probe.js', "import '../../ui/feedback.js';", 'panel state internals ban ui/'],
	['src/charts/bar/data.js', "import '../../ui/feedback.js';", 'chart leaves ban ui/'],
	['src/charts/shared/probe.js', "import '../../ui/feedback.js';", 'charts/shared bans ui/'],
	['src/charts/catalog.js', "import '../ui/feedback.js';", 'catalog/previews ban ui/'],
	['src/charts/registries/controls.js', "import '../../ui/feedback.js';", 'controls registry bans ui/'],
	['src/charts/registries/workspace.js', "import '../../ui/feedback.js';", 'workspace registry bans ui/'],
	['src/charts/registries/panel.js', "import '../../ui/feedback.js';", 'panel registry bans ui/'],
	['src/charts/bar/workspaceSection.js', "import '../../ui/feedback.js';", 'chart integration files ban ui/'],
	['src/charts/bar/controls/listeners.js', "import '../../../ui/feedback.js';", 'control listeners ban ui/'],
	['src/features/datasetWorkspace/datasetController.js', "import 'd3';", 'features block restated BARE_IMPORT_BANS'],
	['src/ui/feedback.js', "import 'd3';", 'ui block restated BARE_IMPORT_BANS'],
	['src/features/settings/settingsDialog.js', "import 'd3';", 'B2d restated BARE_IMPORT_BANS'],
];

// These paths are outside every named UI_LAYER_BAN directory. Only the
// resolver-aware custom rule can reject them.
const STRICT_UI_FORBIDDEN_IMPORTS = [
	['src/ui/feedback.js', "import '../../tests/setup/indexeddb.js';", 'ui cannot import test harness code'],
	['src/ui/feedback.js', "import '../futureLayer/example.js';", 'ui cannot import an unknown future sibling layer'],
];

// [virtual file, import statement, direction the probe proves is allowed]
const ALLOWED_IMPORTS = [
	['src/workers/persistWorker.js', "import '../services/persistence/lifecycle.js';", 'persist worker keeps its A3 exception'],
	['src/features/settings/settingsDialog.js', "import '../../ui/nativeDialog.js';", 'settings dialog may use native dialog infrastructure'],
	['src/features/datasetWorkspace/datasetController.js', "import '../../ui/feedback.js';", 'features may use ui/feedback'],
	['src/app/sharedPageInitializer.js', "import '../features/settings/settingsController.js';", 'app may compose features'],
	['src/ui/feedback.js', "import './nativeDialog.js';", 'ui may import another ui module'],
	['src/ui/feedback.js', "import '../config/settings.js';", 'ui may import config'],
	['src/ui/feedback.js', "import '../utils/result.js';", 'ui may import utils'],
	['src/ui/feedback.js', "import '../types.js';", 'ui may import shared types'],
	['src/ui/feedback.js', "import '../../vendor/d3/d3.js';", 'ui may import vendored modules'],
	['src/config/charts/defaults.js', "import '../../domain/filters/globalFilter.js';", 'config may use domain product rules'],
	['src/domain/charts/chartConfig.js', "import '../../config/charts/defaults.js';", 'domain may use config defaults'],
	['src/state/dataStateFacade.js', "import '../config/charts/definitions.js';", 'state may use chart definitions'],
	['src/charts/bar/data.js', "import '../../domain/filters/chartFilter.js';", 'chart leaves may use domain filter rules'],
	['src/charts/bubble/controls/listeners.js', "import '../../../domain/datasets/columns.js';", 'control listeners may use domain dataset rules'],
	['src/features/panel/slots/lifecycle.js', "import '../../../charts/shared/containerLifecycle.js';", 'features may use shared chart infrastructure'],
	['src/app/bindings/projectTransfer.js', "import '../../services/downloads/bytes.js';", 'app may use browser-effecting services'],
];

describe('lint layer boundaries', () => {
	it.each(FORBIDDEN_IMPORTS)('%s cannot use %s (%s)', async (
		virtualFile,
		code,
		_proves,
		expectedRuleId = 'no-restricted-imports',
	) => {
		const result = await lintProbe(virtualFile, code);
		expect(result.errorCount, `expected a lint error for ${code} in ${virtualFile}`).toBeGreaterThanOrEqual(1);
		const expectedRuleIds = Array.isArray(expectedRuleId) ? expectedRuleId : [expectedRuleId];
		for (const ruleId of expectedRuleIds) {
			expect(
				messagesForRule(result, ruleId).length,
				`expected ${ruleId} to fire for ${code} in ${virtualFile}`,
			).toBeGreaterThanOrEqual(1);
		}
	});

	it.each(STRICT_UI_FORBIDDEN_IMPORTS)('%s cannot use %s (%s)', async (virtualFile, code, _proves) => {
		const result = await lintProbe(virtualFile, code);
		expect(result.errorCount, `expected a lint error for ${code} in ${virtualFile}`).toBeGreaterThanOrEqual(1);
		expect(
			strictUiMessages(result).length,
			`expected chive/ui-strict-leaf to fire for ${code} in ${virtualFile}`,
		).toBeGreaterThanOrEqual(1);
	});

	it.each(ALLOWED_IMPORTS)('%s may use %s (%s)', async (virtualFile, code, _proves) => {
		const result = await lintProbe(virtualFile, code);
		expect(
			restrictionMessages(result),
			`expected no import restriction for ${code} in ${virtualFile}`,
		).toEqual([]);
	});
});
