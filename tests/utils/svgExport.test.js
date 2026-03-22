// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  capturarSvgMarkupDeContainer,
  baixarSvgMarkup,
  downloadSvgFromContainer,
} from '../../src/utils/svgExport.js';

describe('svgExport utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('retorna erros quando container/svg não existem', () => {
    expect(capturarSvgMarkupDeContainer('missing')).toEqual({ ok: false, reason: 'container-not-found' });

    const div = document.createElement('div');
    div.id = 'container';
    document.body.appendChild(div);

    expect(capturarSvgMarkupDeContainer('container')).toEqual({ ok: false, reason: 'svg-not-found' });
  });

  it('captura SVG e injeta atributos obrigatórios', () => {
    const div = document.createElement('div');
    div.id = 'chart';
    div.innerHTML = '<svg width="100" height="50"><rect width="100" height="50" /></svg>';
    document.body.appendChild(div);

    const result = capturarSvgMarkupDeContainer('chart');
    expect(result.ok).toBe(true);
    expect(result.svgMarkup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(result.svgMarkup).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(result.svgMarkup).toContain('viewBox="0 0 100 50"');
  });

  it('baixa SVG com nome sanitizado e valida markup vazio', () => {
    expect(baixarSvgMarkup('', 'Chart')).toEqual({ ok: false, reason: 'empty-markup' });

    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = baixarSvgMarkup('<svg />', '  My Chart!!  ');
    expect(result.ok).toBe(true);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    const anchor = document.querySelector('a');
    expect(anchor).toBeNull();
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('downloadSvgFromContainer encadeia captura e download', () => {
    const div = document.createElement('div');
    div.id = 'chart2';
    div.innerHTML = '<svg width="10" height="10"></svg>';
    document.body.appendChild(div);

    global.URL.createObjectURL = vi.fn(() => 'blob:mock2');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = downloadSvgFromContainer('chart2', 'file');
    expect(result.ok).toBe(true);
  });
});
