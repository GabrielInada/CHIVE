import { collectVendorFindings } from './lib/vendorChecks.mjs';

const findings = collectVendorFindings(process.cwd());

if (findings.length) {
	console.error('Vendor verification failed:');
	for (const finding of findings) {
		console.error(`- ${finding}`);
	}
	process.exitCode = 1;
} else {
	console.log('Vendor verification passed.');
}
