// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBytes, sanitizeDownloadFileName } from '../../../src/services/downloads/bytes.js';

describe('downloads/bytes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('sanitizes binary download names', () => {
		expect(sanitizeDownloadFileName('  My Project!!.chive.sqlite3  ')).toBe('my-project.chive.sqlite3');
		expect(sanitizeDownloadFileName('!!!', 'fallback.bin')).toBe('fallback.bin');
	});

	it('downloads Uint8Array payloads and rejects empty input', () => {
		expect(downloadBytes(new Uint8Array(), 'project.bin')).toEqual({ ok: false, reason: 'empty-bytes' });

		const createObjectURL = vi.fn(() => 'blob:bytes');
		const revokeObjectURL = vi.fn();
		global.URL.createObjectURL = createObjectURL;
		global.URL.revokeObjectURL = revokeObjectURL;
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		const result = downloadBytes(new Uint8Array([1, 2, 3]), ' Project File ', { mimeType: 'application/test' });

		expect(result.ok).toBe(true);
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:bytes');
		expect(document.querySelector('a')).toBeNull();
		expect(clickSpy).toHaveBeenCalledTimes(1);
		clickSpy.mockRestore();
	});
});
