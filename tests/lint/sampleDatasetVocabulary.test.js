import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve('src');

function sourceFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? sourceFiles(file) : [file];
	});
}

// These contracts describe bundled datasets. Color presets deliberately keep
// their names. Runtime tests cannot detect stale JSDoc types or unused keys.
const retiredContract = /\b(?:PRESET_CATALOG|PRESET_FETCH_TIMEOUT_MS|PresetDescriptor|PresetSource|PresetCatalogEntry|presetCatalog|presetService|presetDatasetsDialog|loadPresetSource|loadPresetDataset|handlePresetDatasetRequest|openPresetDatasetsDialog|buildPresetCard|onLoadPreset)\b|chive-(?:preset-|btn-preset-datasets)|['"`]preset-(?:missing|data-missing|fetch-)|\/presets\//;
const retiredModulePath = /(?:^|\/)(?:presets\/|(?:presetCatalog|presetService|presetDatasetsDialog|loadPresetDataset)\.js$)/;

describe('sample dataset vocabulary', () => {
	it('removes retired module names, identifiers, message keys, and reason codes', () => {
		const stale = [];
		for (const file of sourceFiles(sourceRoot)) {
			const relative = path.relative(sourceRoot, file).split(path.sep).join('/');
			if (retiredModulePath.test(relative)) stale.push(relative);
			if (!/\.(?:js|json)$/.test(file)) continue;
			readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
				if (retiredContract.test(line)) stale.push(`${relative}:${index + 1}`);
			});
		}
		expect(stale).toEqual([]);
	});

	it.each([
		'data/sampleDatasetCatalog.js',
		'services/sampleDatasetService.js',
		'features/datasetWorkspace/datasetController.js',
		'features/datasetWorkspace/workflows/loadSampleDataset.js',
		'features/datasetWorkspace/dialogs/sampleDatasetsDialog.js',
		'features/datasetWorkspace/dialogs/chartTypePickerDialog.js',
		'features/datasetWorkspace/views/fileListView.js',
	])('uses sample dataset names throughout %s', relative => {
		expect(readFileSync(path.join(sourceRoot, relative), 'utf8')).not.toMatch(/preset/i);
	});
});
