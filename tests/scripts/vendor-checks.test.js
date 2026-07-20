import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
	collectVendorFindings,
	compareVersionSources,
	extractFontUrls,
	extractSqliteLibVersion,
	parseProvenanceHeader,
	parseVendorReadmeVersions,
} from '../../scripts/lib/vendorChecks.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const COMPLETE_README_TABLE = `
| Package | Version | Runtime file | License |
|---|---:|---|---|
| D3 | 7.9.0 | d3.js | ISC |
| banana-i18n | 2.4.0 | banana-i18n.js | MIT |
| Three.js | 0.185.1 | three.module.js | MIT |
| SQLite-WASM | 3.53.0-build1 | sqlite3.js | Apache-2.0 |
`;

describe('vendor checks', () => {
	it('reports no findings for the checked-in vendor tree', () => {
		expect(collectVendorFindings(repoRoot)).toEqual([]);
	});

	it('parses a provenance header', () => {
		expect(
			parseProvenanceHeader(
				'// Vendored from three@0.185.1. Upstream license: MIT.',
			),
		).toEqual({
			packageName: 'three',
			version: '0.185.1',
			license: 'MIT',
		});
	});

	it('rejects a malformed provenance header', () => {
		expect(() => parseProvenanceHeader('three 0.185.1 MIT')).toThrow(
			'Invalid provenance header',
		);
	});

	it('parses every required vendor README version row', () => {
		expect(parseVendorReadmeVersions(COMPLETE_README_TABLE)).toEqual({
			d3: '7.9.0',
			'banana-i18n': '2.4.0',
			three: '0.185.1',
			'@sqlite.org/sqlite-wasm': '3.53.0-build1',
		});
	});

	it('rejects a vendor README with a required row missing', () => {
		expect(() =>
			parseVendorReadmeVersions(
				COMPLETE_README_TABLE.replace(
					'| D3 | 7.9.0 | d3.js | ISC |\n',
					'',
				),
			),
		).toThrow('Missing vendor README row for D3');
	});

	it('reports version-source disagreement', () => {
		expect(compareVersionSources('d3', {
			'package-lock.json': '7.9.0',
			'vendor/README.md': '7.8.5',
			'vendor/d3/d3.js': '7.9.0',
		})).toEqual([
			'd3 version mismatch: package-lock.json=7.9.0, vendor/README.md=7.8.5, vendor/d3/d3.js=7.9.0.',
		]);
	});

	it('extracts the SQLite library version marker', () => {
		expect(extractSqliteLibVersion('"libVersion": "3.53.0",')).toBe('3.53.0');
		expect(() => extractSqliteLibVersion('const sqlite = {};')).toThrow(
			'Missing SQLite "libVersion" marker',
		);
	});

	it('extracts font URLs without splitting filenames at commas', () => {
		const css = `
			src: url('./ibm-plex-sans/IBMPlexSans-VariableFont_wdth,wght.woff2') format('woff2');
			src: url('./jetbrains-mono/JetBrainsMono-Regular.woff2') format('woff2');
		`;
		expect(extractFontUrls(css)).toEqual([
			'./ibm-plex-sans/IBMPlexSans-VariableFont_wdth,wght.woff2',
			'./jetbrains-mono/JetBrainsMono-Regular.woff2',
		]);
	});
});
