/**
 * Configuration for chart rendering and visualization options.
 */

export const CHART_TYPES = {
  BAR: 'bar',
  SCATTER: 'scatter',
  NETWORK: 'network',
  PIE: 'pie',
  TREEMAP: 'treemap',
};

export const CHART_COLORS = {
  bar: '#d4622a',
  scatter: '#1a472a',
  network: '#3b6a9f',
  pie: '#5f7c33',
  treemap: '#5a7d99',
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
  pie: {
    width: 700,
    height: 360,
    margins: {
      top: 16,
      right: 16,
      bottom: 16,
      left: 16,
    },
  },
};

export const BAR_CHART = {
  padding: 0.14,
  ticks: 6,
  sortOptions: ['count-desc', 'count-asc', 'label-asc', 'label-desc'],
  defaultSort: 'count-desc',
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 10,
  measureModes: ['count', 'sum', 'mean'],
  defaultMeasureMode: 'count',
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

export const NETWORK_GRAPH = {
  defaultNodeRadius: 5,
  defaultLinkDistance: 46,
  defaultChargeStrength: -80,
  defaultLinkOpacity: 0.45,
  defaultZoomScale: 1,
  defaultAlphaDecay: 0.045,
  minZoomScale: 0.3,
  maxZoomScale: 4,
  minAlphaDecay: 0.01,
  maxAlphaDecay: 0.2,
};

export const PIE_CHART = {
  defaultInnerRadius: 0,
  defaultOuterRadius: 100,
  defaultPadAngle: 0,
  defaultZoomScale: 1,
  minZoomScale: 0.3,
  maxZoomScale: 4,
  minPadAngle: 0,
  maxPadAngle: 12,
  minInnerRadius: 0,
  maxOuterRadius: 140,
  minOuterRadius: 20,
  measureModes: ['count', 'sum'],
  labelPositions: ['inside', 'outside'],
};

export const TREEMAP_CHART = {
  measureModes: ['count', 'sum'],
  defaultMeasureMode: 'count',
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 20,
  paddingOptions: [1, 2, 4],
  defaultPadding: 2,
};

export const CHART_EMPTY_STATES = {
  noData: 'Sem dados suficientes para este gráfico.',
  logNoPositive: 'Sem valores positivos suficientes para escala log nas colunas selecionadas.',
};
