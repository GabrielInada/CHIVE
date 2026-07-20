import {
	existsSync,
	readFileSync,
	readdirSync,
	statSync,
} from 'node:fs';
import path from 'node:path';

const README_PACKAGE_NAMES = Object.freeze({
	D3: 'd3',
	'banana-i18n': 'banana-i18n',
	'Three.js': 'three',
	'SQLite-WASM': '@sqlite.org/sqlite-wasm',
});

const PACKAGE_SPECS = Object.freeze([
	{
		name: 'd3',
		vendorDirectory: 'vendor/d3',
		files: ['LICENSE', 'd3.js'],
		provenanceFiles: [{ file: 'vendor/d3/d3.js', license: 'ISC' }],
	},
	{
		name: 'banana-i18n',
		vendorDirectory: 'vendor/banana-i18n',
		files: ['LICENSE', 'banana-i18n.js'],
		provenanceFiles: [{ file: 'vendor/banana-i18n/banana-i18n.js', license: 'MIT' }],
	},
	{
		name: 'three',
		vendorDirectory: 'vendor/three',
		files: ['LICENSE', 'three.core.js', 'three.module.js'],
		provenanceFiles: [
			{ file: 'vendor/three/three.core.js', license: 'MIT' },
			{ file: 'vendor/three/three.module.js', license: 'MIT' },
		],
	},
	{
		name: '@sqlite.org/sqlite-wasm',
		vendorDirectory: 'vendor/sqlite',
		files: [
			'sqlite3-opfs-async-proxy.js',
			'sqlite3-worker1.mjs',
			'sqlite3.js',
			'sqlite3.wasm',
		],
		provenanceFiles: [],
	},
]);

const FONT_LICENSE_FILES = Object.freeze([
	'vendor/fonts/ibm-plex-sans/OFL.txt',
	'vendor/fonts/ibm-plex-serif/OFL.txt',
	'vendor/fonts/jetbrains-mono/OFL.txt',
]);

const BYTE_PARITY_FILES = Object.freeze([
	{
		vendor: 'vendor/three/three.module.js',
		installed: 'node_modules/three/build/three.module.js',
		stripProvenance: true,
	},
	{
		vendor: 'vendor/three/three.core.js',
		installed: 'node_modules/three/build/three.core.js',
		stripProvenance: true,
	},
	{
		vendor: 'vendor/sqlite/sqlite3.wasm',
		installed: 'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm',
		stripProvenance: false,
	},
]);

/**
 * Parse the one-line provenance stamp used by copied or locally bundled
 * vendored JavaScript.
 *
 * @param {string} line
 * @returns {{ packageName: string, version: string, license: string }}
 */
export function parseProvenanceHeader(line) {
	const match = String(line).replace(/\r$/, '').match(
		/^\/\/ Vendored from (\S+)@(\S+?)\. Upstream license: (.+)\.$/,
	);
	if (!match) {
		throw new Error('Invalid provenance header.');
	}
	return {
		packageName: match[1],
		version: match[2],
		license: match[3],
	};
}

/**
 * Parse the required dependency-version rows from vendor/README.md.
 *
 * @param {string} markdown
 * @returns {Readonly<Record<string, string>>}
 */
export function parseVendorReadmeVersions(markdown) {
	const versions = {};
	for (const line of String(markdown).split(/\r?\n/)) {
		const cells = line
			.split('|')
			.slice(1, -1)
			.map(cell => cell.trim());
		if (cells.length < 2) continue;

		const packageName = README_PACKAGE_NAMES[cells[0]];
		if (!packageName) continue;
		if (Object.hasOwn(versions, packageName)) {
			throw new Error(`Duplicate vendor README row for ${cells[0]}.`);
		}
		versions[packageName] = cells[1].replace(/^`|`$/g, '');
	}

	for (const [displayName, packageName] of Object.entries(README_PACKAGE_NAMES)) {
		if (!versions[packageName]) {
			throw new Error(`Missing vendor README row for ${displayName}.`);
		}
	}
	return Object.freeze(versions);
}

/**
 * Extract SQLite's embedded runtime library version.
 *
 * @param {string} source
 * @returns {string}
 */
export function extractSqliteLibVersion(source) {
	const match = String(source).match(/"libVersion"\s*:\s*"([^"]+)"/);
	if (!match) {
		throw new Error('Missing SQLite "libVersion" marker.');
	}
	return match[1];
}

/**
 * Extract single-quoted relative font sources without treating commas in
 * filenames as separators.
 *
 * @param {string} css
 * @returns {string[]}
 */
export function extractFontUrls(css) {
	return Array.from(
		String(css).matchAll(/url\(\s*'([^']+)'\s*\)/g),
		match => match[1],
	);
}

/**
 * Report whether named version sources disagree.
 *
 * @param {string} packageName
 * @param {Record<string, string | undefined>} sources
 * @returns {string[]}
 */
export function compareVersionSources(packageName, sources) {
	const entries = Object.entries(sources).filter(([, version]) => version);
	if (new Set(entries.map(([, version]) => version)).size <= 1) return [];
	return [
		`${packageName} version mismatch: ${entries
			.map(([source, version]) => `${source}=${version}`)
			.join(', ')}.`,
	];
}

/**
 * Read a package's locked version from package-lock.json data.
 *
 * @param {object} lockfile
 * @param {string} packageName
 * @returns {string}
 */
export function getLockedVersion(lockfile, packageName) {
	const version = lockfile?.packages?.[`node_modules/${packageName}`]?.version;
	if (!version) {
		throw new Error(`Missing lockfile package entry for ${packageName}.`);
	}
	return version;
}

function readRequiredFile(rootDir, relativePath, findings, encoding = null) {
	try {
		return readFileSync(path.join(rootDir, relativePath), encoding ?? undefined);
	} catch (error) {
		findings.push(
			`Cannot read required file ${relativePath}: ${error.message}`,
		);
		return null;
	}
}

function checkExactFileSet(rootDir, spec, findings) {
	const directory = path.join(rootDir, spec.vendorDirectory);
	let actual;
	try {
		actual = readdirSync(directory, { withFileTypes: true })
			.map(entry => entry.name)
			.sort();
	} catch (error) {
		findings.push(
			`Cannot inspect vendor companion set ${spec.vendorDirectory}: ${error.message}`,
		);
		return;
	}

	const expected = [...spec.files].sort();
	const missing = expected.filter(file => !actual.includes(file));
	const unexpected = actual.filter(file => !expected.includes(file));
	if (missing.length) {
		findings.push(
			`${spec.vendorDirectory} is missing companion files: ${missing.join(', ')}.`,
		);
	}
	if (unexpected.length) {
		findings.push(
			`${spec.vendorDirectory} has unexpected companion files: ${unexpected.join(', ')}.`,
		);
	}
}

function stripFirstLine(buffer) {
	const newlineIndex = buffer.indexOf(0x0a);
	return newlineIndex === -1 ? buffer.subarray(buffer.length) : buffer.subarray(newlineIndex + 1);
}

function firstLine(buffer) {
	const newlineIndex = buffer.indexOf(0x0a);
	const end = newlineIndex === -1 ? buffer.length : newlineIndex;
	return buffer.subarray(0, end).toString('utf8').replace(/\r$/, '');
}

function checkByteParity(rootDir, comparison, findings) {
	const vendorBuffer = readRequiredFile(rootDir, comparison.vendor, findings);
	if (!vendorBuffer) return;

	const installedPath = path.join(rootDir, comparison.installed);
	let installedBuffer;
	try {
		installedBuffer = readFileSync(installedPath);
	} catch (error) {
		findings.push(
			`Cannot read ${comparison.installed}; run npm ci before vendor verification. ${error.message}`,
		);
		return;
	}

	const comparableVendor = comparison.stripProvenance
		? stripFirstLine(vendorBuffer)
		: vendorBuffer;
	if (!comparableVendor.equals(installedBuffer)) {
		const qualifier = comparison.stripProvenance
			? ' after removing its provenance header'
			: '';
		findings.push(
			`Byte parity failed: ${comparison.vendor}${qualifier} differs from ${comparison.installed}.`,
		);
	}
}

function checkFontIntegrity(rootDir, findings) {
	for (const licenseFile of FONT_LICENSE_FILES) {
		if (!existsSync(path.join(rootDir, licenseFile))) {
			findings.push(`Missing required font license ${licenseFile}.`);
		}
	}

	const cssPath = 'vendor/fonts/fonts.css';
	const css = readRequiredFile(rootDir, cssPath, findings, 'utf8');
	if (css === null) return;

	const urls = extractFontUrls(css);
	const rawUrlCount = (css.match(/url\(/g) ?? []).length;
	if (urls.length !== rawUrlCount) {
		findings.push(
			`${cssPath} contains a url() source that is not a single-quoted relative path.`,
		);
	}

	const fontsDirectory = path.join(rootDir, 'vendor/fonts');
	for (const url of urls) {
		const target = path.resolve(fontsDirectory, url);
		const relativeTarget = path.relative(fontsDirectory, target);
		if (
			relativeTarget.startsWith(`..${path.sep}`) ||
			relativeTarget === '..' ||
			path.isAbsolute(relativeTarget)
		) {
			findings.push(`${cssPath} URL escapes vendor/fonts/: ${url}.`);
			continue;
		}
		if (!existsSync(target) || !statSync(target).isFile()) {
			findings.push(`${cssPath} references missing font file ${url}.`);
		}
	}
}

/**
 * Verify the checked-in runtime dependencies against their documented and
 * reproducible package-lock/node_modules sources.
 *
 * @param {string} rootDir Repository root.
 * @returns {string[]} Human-readable findings. Empty means verification passed.
 */
export function collectVendorFindings(rootDir) {
	const findings = [];
	const lockfileText = readRequiredFile(rootDir, 'package-lock.json', findings, 'utf8');
	const readmeText = readRequiredFile(rootDir, 'vendor/README.md', findings, 'utf8');

	let lockfile = null;
	if (lockfileText !== null) {
		try {
			lockfile = JSON.parse(lockfileText);
		} catch (error) {
			findings.push(`Cannot parse package-lock.json: ${error.message}`);
		}
	}

	let readmeVersions = null;
	if (readmeText !== null) {
		try {
			readmeVersions = parseVendorReadmeVersions(readmeText);
		} catch (error) {
			findings.push(`Cannot parse vendor/README.md versions: ${error.message}`);
		}
	}

	const lockedVersions = {};
	if (lockfile) {
		for (const spec of PACKAGE_SPECS) {
			try {
				lockedVersions[spec.name] = getLockedVersion(lockfile, spec.name);
			} catch (error) {
				findings.push(error.message);
			}
		}
	}

	for (const spec of PACKAGE_SPECS) {
		checkExactFileSet(rootDir, spec, findings);
		const installedDirectory = path.join(rootDir, 'node_modules', spec.name);
		if (!existsSync(installedDirectory)) {
			findings.push(
				`Installed package directory node_modules/${spec.name} is missing; run npm ci before vendor verification.`,
			);
		}

		for (const provenance of spec.provenanceFiles) {
			const buffer = readRequiredFile(rootDir, provenance.file, findings);
			if (!buffer) continue;

			let parsed;
			try {
				parsed = parseProvenanceHeader(firstLine(buffer));
			} catch (error) {
				findings.push(`${provenance.file}: ${error.message}`);
				continue;
			}
			if (parsed.packageName !== spec.name) {
				findings.push(
					`${provenance.file} provenance names ${parsed.packageName}; expected ${spec.name}.`,
				);
			}
			if (parsed.license !== provenance.license) {
				findings.push(
					`${provenance.file} provenance license is ${parsed.license}; expected ${provenance.license}.`,
				);
			}
			findings.push(...compareVersionSources(spec.name, {
				'package-lock.json': lockedVersions[spec.name],
				'vendor/README.md': readmeVersions?.[spec.name],
				[provenance.file]: parsed.version,
			}));
		}

		if (!spec.provenanceFiles.length) {
			findings.push(...compareVersionSources(spec.name, {
				'package-lock.json': lockedVersions[spec.name],
				'vendor/README.md': readmeVersions?.[spec.name],
			}));
		}
	}

	const sqliteSource = readRequiredFile(
		rootDir,
		'vendor/sqlite/sqlite3.js',
		findings,
		'utf8',
	);
	if (sqliteSource !== null) {
		try {
			const libraryVersion = extractSqliteLibVersion(sqliteSource);
			const lockedVersion = lockedVersions['@sqlite.org/sqlite-wasm'];
			if (lockedVersion && !lockedVersion.startsWith(libraryVersion)) {
				findings.push(
					`SQLite embedded libVersion ${libraryVersion} is not a prefix of locked @sqlite.org/sqlite-wasm ${lockedVersion}.`,
				);
			}
		} catch (error) {
			findings.push(`vendor/sqlite/sqlite3.js: ${error.message}`);
		}
	}

	for (const comparison of BYTE_PARITY_FILES) {
		checkByteParity(rootDir, comparison, findings);
	}
	checkFontIntegrity(rootDir, findings);

	return findings;
}
