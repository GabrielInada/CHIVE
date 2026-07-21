import { describe, expect, it } from 'vitest';
import * as appState from '../../src/state/appState.js';
import { STATE_EVENTS } from '../../src/state/stateEvents.js';
import { SUPPORTED_PANEL_CHART_TYPES } from '../../src/charts/registries/panel.js';
import {
	SQLITE_IDB_NAME,
	SQLITE_IDB_PROJECT_KEY,
	SQLITE_IDB_STORE,
} from '../../src/services/persistence/backends/blobBackend.js';
import {
	LEGACY_DB_NAME,
	LEGACY_MIGRATION_MARKER_KEY,
	LEGACY_PANEL_KEY,
	LEGACY_STORE_DATASETS,
	LEGACY_STORE_PANEL,
} from '../../src/services/persistence/backends/legacyIndexedDbReader.js';
import {
	SQLITE_FORMAT,
	SQLITE_SCHEMA_VERSION,
} from '../../src/services/persistence/sqlite/core.js';
import { LOCALE_STORAGE_KEY } from '../../src/config/locale.js';
import { SETTINGS_STORAGE_KEY } from '../../src/config/settings.js';
import {
	collectStateBusSites,
	eslintMutableGetterLists,
	extractJsonContract,
	extractMarkdownTable,
	localMarkdownLinkProblems,
	missingRepoPaths,
	readRepoFile,
	readStringConstant,
	sourceMapTreePaths,
	splitContractSites,
	sqliteIndexedDbVersion,
	sqliteTableNames,
	stripInlineCode,
} from './architectureDocs.testSupport.js';

const ARCHITECTURE_DOCS = [
	'docs/development/architecture.md',
	'docs/development/architecture-reference.md',
	'docs/development/source-map.md',
	'CONTRIBUTING.md',
	'docs/development/contributor-reference.md',
];

const reference = readRepoFile('docs/development/architecture-reference.md');
const sourceMap = readRepoFile('docs/development/source-map.md');

describe('architecture documentation drift guards', () => {
	it('resolves every local Markdown file and anchor in the audited documents', () => {
		expect(localMarkdownLinkProblems(ARCHITECTURE_DOCS)).toEqual([]);
	});

	it('keeps every literal path in the source-map tree present', () => {
		expect(missingRepoPaths(sourceMapTreePaths(sourceMap))).toEqual([]);
	});

	it('documents the exact fresh default state', () => {
		expect(extractJsonContract(reference, 'architecture-default-state')).toEqual(appState.getState());
	});

	it('documents every appState named export', () => {
		const documented = extractJsonContract(reference, 'architecture-app-state-exports');
		expect([...documented].sort()).toEqual(Object.keys(appState).sort());
	});

	it('documents every state event value, emitter, and production subscription', () => {
		const rows = extractMarkdownTable(reference, [
			'Constant',
			'Value',
			'Emitters',
			'Production subscriptions',
			'Payload',
		]);
		const documentedValues = Object.fromEntries(rows.map(row => [
			stripInlineCode(row.Constant),
			stripInlineCode(row.Value),
		]));
		expect(documentedValues).toEqual(STATE_EVENTS);

		const { emitters, subscribers } = collectStateBusSites();
		const documentedEmitters = {};
		const documentedSubscribers = {};
		for (const row of rows) {
			const eventName = stripInlineCode(row.Constant);
			const eventEmitters = splitContractSites(row.Emitters);
			const eventSubscribers = splitContractSites(row['Production subscriptions']);
			if (eventEmitters.length) documentedEmitters[eventName] = eventEmitters;
			if (eventSubscribers.length) documentedSubscribers[eventName] = eventSubscribers;
		}
		expect(documentedEmitters).toEqual(emitters);
		expect(documentedSubscribers).toEqual(subscribers);
	});

	it('keeps the documented getter guard list aligned with both ESLint guards', () => {
		const documented = extractJsonContract(reference, 'architecture-mutable-getters').sort();
		const { inline, tracked } = eslintMutableGetterLists();
		expect(documented).toEqual(inline);
		expect(documented).toEqual(tracked);
	});

	it('keeps supported panel chart order aligned with the panel registry', () => {
		expect(extractJsonContract(reference, 'architecture-panel-chart-types'))
			.toEqual([...SUPPORTED_PANEL_CHART_TYPES]);
	});

	it('keeps persistence identifiers and SQLite schema aligned with source', () => {
		const storage = extractJsonContract(reference, 'architecture-persistence-storage');
		expect(storage.indexedDB).toMatchObject({
			database: SQLITE_IDB_NAME,
			version: sqliteIndexedDbVersion(),
			objectStore: SQLITE_IDB_STORE,
			projectKey: SQLITE_IDB_PROJECT_KEY,
		});
		expect(storage.sqlite.format).toBe(SQLITE_FORMAT);
		expect(storage.sqlite.schemaVersion).toBe(SQLITE_SCHEMA_VERSION);
		expect([...storage.sqlite.tables].sort()).toEqual(sqliteTableNames());
		expect(storage.legacyIndexedDB).toEqual({
			database: LEGACY_DB_NAME,
			stores: [LEGACY_STORE_DATASETS, LEGACY_STORE_PANEL],
			panelKey: LEGACY_PANEL_KEY,
		});
		expect(storage.localStorage).toEqual({
			uiPreferences: readStringConstant('src/services/persistence/uiPrefs.js', 'UI_LOCAL_STORAGE_KEY'),
			locale: LOCALE_STORAGE_KEY,
			settings: SETTINGS_STORAGE_KEY,
			migrationMarker: LEGACY_MIGRATION_MARKER_KEY,
		});
	});
});
