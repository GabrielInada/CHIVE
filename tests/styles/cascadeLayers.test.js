import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesRoot = path.resolve('src/styles');

function readStyle(fileName) {
	return readFileSync(path.join(stylesRoot, fileName), 'utf8');
}

describe('cascade layer composition', () => {
	it('does not wrap chrome.css in a second foundation layer', () => {
		expect(readStyle('app.css')).toContain("@import url('./base.css');");
		expect(readStyle('base.css')).toContain("@import url('./chrome.css');");
		expect(readStyle('base.css')).not.toContain("@import url('./chrome.css') layer(foundation)");
	});

	it('does not declare a nested foundation.foundation layer', () => {
		const graph = [
			readStyle('app.css'),
			readStyle('base.css'),
			readStyle('chrome.css'),
		].join('\n');
		expect(graph).not.toContain('foundation.foundation');
	});
});
