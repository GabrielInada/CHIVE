// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  addChartSnapshot,
  assignChartToSlot,
  getChartSnapshot,
  getPanelSlots,
  removeChartSnapshot,
  resetState,
} from '../src/modules/appState.js';

describe('appState panel chart IDs', () => {
  beforeEach(() => {
    resetState();
  });

  it('stores first chart with id 0 and resolves string id lookups', () => {
    const id = addChartSnapshot({ nome: 'Chart A', svgMarkup: '<svg />' });

    expect(id).toBe(0);
    expect(getChartSnapshot(0)?.nome).toBe('Chart A');
    expect(getChartSnapshot('0')?.nome).toBe('Chart A');
  });

  it('assigns string chart IDs to slots with normalization', () => {
    addChartSnapshot({ nome: 'Chart A', svgMarkup: '<svg />' });

    assignChartToSlot('slot-1', '0');

    expect(getPanelSlots()['slot-1']).toBe(0);
  });

  it('clears slot assignment when chart is removed', () => {
    const id = addChartSnapshot({ nome: 'Chart A', svgMarkup: '<svg />' });
    assignChartToSlot('slot-1', id);

    removeChartSnapshot(id);

    expect(getPanelSlots()['slot-1']).toBeUndefined();
    expect(getChartSnapshot(id)).toBeNull();
  });
});
