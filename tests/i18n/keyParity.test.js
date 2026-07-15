import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import ptBR from '../../src/i18n/pt-BR.json';
import qqq from '../../src/i18n/qqq.json';

const catalogs = [
	{ name: 'en', messages: en },
	{ name: 'pt-BR', messages: ptBR },
	{ name: 'qqq', messages: qqq },
];

function messageKeys(messages) {
	return Object.keys(messages)
		.filter(key => key !== '@metadata')
		.sort();
}

describe('i18n message catalogs', () => {
	it('keep the same message key set across locales and qqq documentation', () => {
		const expected = messageKeys(en);

		catalogs.forEach(({ messages }) => {
			expect(messageKeys(messages)).toEqual(expected);
		});
	});

	it('documents every translated message with non-empty qqq context', () => {
		messageKeys(en).forEach(key => {
			expect(String(qqq[key] || '').trim(), key).not.toBe('');
		});
	});
});
