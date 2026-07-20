import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
	collectVendorFindings,
	getLockedVersion,
} from './lib/vendorChecks.mjs';

const THREE_FILES = Object.freeze(['three.module.js', 'three.core.js']);

function printGuidance() {
	console.log(`Vendor synchronization guidance:
- three: run "node scripts/sync-vendor.mjs three" to copy both upstream ESM files and stamp their provenance headers.
- d3 and banana-i18n: regenerate their checked-in bundles with the appropriate bundler; they are not npm dist copies and the historical bundlers are not pinned here.
- @sqlite.org/sqlite-wasm: regenerate and replace sqlite3.js, sqlite3-worker1.mjs, sqlite3-opfs-async-proxy.js, and sqlite3.wasm as one compatible set. Do not update only the WASM file.
- Update vendor/README.md manually after every version change, then run "npm run verify:vendor".

See vendor/README.md for the provenance and compatibility rules.`);
}

function syncThree(rootDir) {
	const lockfile = JSON.parse(
		readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'),
	);
	const version = getLockedVersion(lockfile, 'three');
	const header = `// Vendored from three@${version}. Upstream license: MIT.\n`;

	for (const file of THREE_FILES) {
		const source = readFileSync(
			path.join(rootDir, 'node_modules', 'three', 'build', file),
			'utf8',
		);
		writeFileSync(path.join(rootDir, 'vendor', 'three', file), header + source, 'utf8');
	}

	const findings = collectVendorFindings(rootDir);
	if (findings.length) {
		console.error('Three.js files were synchronized, but vendor verification still reports:');
		for (const finding of findings) {
			console.error(`- ${finding}`);
		}
		process.exitCode = 1;
		return;
	}
	console.log(`Three.js ${version} is synchronized and vendor verification passes.`);
}

const target = process.argv[2];
if (!target) {
	printGuidance();
} else if (target === 'three') {
	syncThree(process.cwd());
} else {
	console.error(`Unknown vendor target: ${target}`);
	printGuidance();
	process.exitCode = 1;
}
