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
 * green. Each probe below lints a virtual file (via lintText with a filePath
 * inside the layer under test) against the real config, proving the boundary
 * still fires in the exact block that owns that file.
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

async function lintImport(virtualFile, code) {
	const [result] = await eslint.lintText(code, { filePath: abs(virtualFile) });
	return result;
}

const restrictedImportMessages = result =>
	result.messages.filter(message => message.ruleId === 'no-restricted-imports');

// [virtual file, import statement, boundary the probe proves]
const FORBIDDEN_IMPORTS = [
	['src/features/datasetWorkspace/datasetController.js', "import '../../app/feedbackUI.js';", 'features block bans app/'],
	['src/features/datasetWorkspace/datasetController.js', "import '../../entries/app.js';", 'features block bans entries/'],
	['src/features/datasetWorkspace/datasetController.js', "import '../../services/persistence/lifecycle.js';", 'features block bans persistence internals'],
	['src/features/datasetWorkspace/dialogs/globalFilterDialog.js', "import '../../../app/dialogFocus.js';", 'B2c restated the composition ban'],
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
	['src/entries/about.js', "import '../ui/dialogFocus.js';", 'entries cannot import ui/'],
	['src/utils/probe.js', "import '../ui/feedback.js';", 'utils bans ui/'],
	['src/config/probe.js', "import '../ui/feedback.js';", 'config bans ui/'],
	['src/domain/panel/probe.js', "import '../../ui/feedback.js';", 'domain bans ui/'],
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

// [virtual file, import statement, direction the probe proves is allowed]
const ALLOWED_IMPORTS = [
	['src/features/settings/settingsDialog.js', "import '../../ui/dialogFocus.js';", 'settings dialog may use ui/dialogFocus'],
	['src/features/datasetWorkspace/datasetController.js', "import '../../ui/feedback.js';", 'features may use ui/feedback'],
	['src/app/sharedPageInitializer.js', "import '../features/settings/settingsController.js';", 'app may compose features'],
];

describe('lint layer boundaries', () => {
	it.each(FORBIDDEN_IMPORTS)('%s cannot use %s (%s)', async (virtualFile, code, _proves) => {
		const result = await lintImport(virtualFile, code);
		expect(result.errorCount, `expected a lint error for ${code} in ${virtualFile}`).toBeGreaterThanOrEqual(1);
		expect(
			restrictedImportMessages(result).length,
			`expected no-restricted-imports to fire for ${code} in ${virtualFile}`,
		).toBeGreaterThanOrEqual(1);
	});

	it.each(ALLOWED_IMPORTS)('%s may use %s (%s)', async (virtualFile, code, _proves) => {
		const result = await lintImport(virtualFile, code);
		expect(
			restrictedImportMessages(result),
			`expected no import restriction for ${code} in ${virtualFile}`,
		).toEqual([]);
	});
});
