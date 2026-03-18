/**
 * Configuration for chart rendering and visualization options.
 */

export const CHART_TYPES = {
  BAR: 'bar',
  SCATTER: 'scatter',
};

export const CHART_COLORS = {
  bar: '#d4622a',
  scatter: '#1a472a',
};

export const CHART_DIMENSIONS = {
  bar: {
    width: 700,
    height: 320,
    margins: {
      top: 12,
      right: 12,
      bottom: 90,
      left: 52,
    },
  },
  scatter: {
    width: 700,
    height: 320,
    margins: {
      top: 12,
      right: 12,
      bottom: 44,
      left: 52,
    },
  },
};

export const BAR_CHART = {
  padding: 0.14,
  ticks: 6,
  sortOptions: ['count-desc', 'count-asc', 'label-asc', 'label-desc'],
  defaultSort: 'count-desc',
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 0,
};

export const SCATTER_PLOT = {
  ticks: 8,
  scaleOptions: ['linear', 'log'],
  defaultScale: 'linear',
  radiusOptions: [2, 3, 4, 6],
  defaultRadius: 3,
  opacityOptions: [0.3, 0.5, 0.7, 1],
  defaultOpacity: 0.7,
};

export const CHART_EMPTY_STATES = {
  noData: 'Sem dados suficientes para este gráfico.',
  logNoPositive: 'Sem valores positivos suficientes para escala log nas colunas selecionadas.',
};
