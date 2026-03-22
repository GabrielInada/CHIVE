// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  detectarTipo,
  parsearCSV,
  parsearJSON,
  processarDados,
  calcularEstatisticas,
  formatarTamanhoArquivo,
} from '../src/services/dataService.js';

describe('dataService', () => {
  it('detecta tipo numero e texto corretamente', () => {
    expect(detectarTipo(['1', '2', '3', '4'])).toBe('numero');
    expect(detectarTipo(['abc', 'def', 'ghi'])).toBe('texto');
  });

  it('parseia CSV e rejeita CSV vazio', () => {
    const rows = parsearCSV('a,b\n1,2\n3,4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');

    expect(() => parsearCSV('')).toThrow('O arquivo CSV está vazio.');
  });

  it('parseia JSON em formatos suportados e rejeita inválido', () => {
    const arr = parsearJSON('[{"a":1},{"a":2}]');
    expect(arr.length).toBe(2);

    const nested = parsearJSON('{"items":[{"x":1}]}');
    expect(nested.length).toBe(1);

    expect(() => parsearJSON('{')).toThrow('O arquivo JSON contém erros de sintaxe. Verifique o formato.');
    expect(() => parsearJSON('{"foo":1}')).toThrow('Formato JSON não reconhecido. O arquivo deve ser um array de objetos: [{...}, {...}]');
  });

  it('processa dados convertendo colunas numericas e calcula estatisticas', () => {
    const input = [
      { a: '1', b: 'x' },
      { a: '2', b: 'y' },
      { a: '3', b: 'z' },
    ];

    const processed = processarDados(input);
    expect(processed.colunas.find(c => c.nome === 'a')?.tipo).toBe('numero');
    expect(typeof processed.dados[0].a).toBe('number');

    const stats = calcularEstatisticas(processed.dados, processed.colunas);
    expect(stats.length).toBe(1);
    expect(stats[0].nome).toBe('a');
    expect(stats[0].min).toBe(1);
    expect(stats[0].max).toBe(3);
    expect(stats[0].media).toBe(2);
  });

  it('formata tamanhos de arquivo em B KB e MB', () => {
    expect(formatarTamanhoArquivo(100)).toBe('100 B');
    expect(formatarTamanhoArquivo(2048)).toBe('2.0 KB');
    expect(formatarTamanhoArquivo(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
