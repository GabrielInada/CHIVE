/**
 * Configuration for chart rendering and visualization options.
 */

export const CHART_TYPES = {
  BAR: 'bar',
  SCATTER: 'scatter',
  NETWORK: 'network',
  PIE: 'pie',
  TREEMAP: 'treemap',
  BUBBLE: 'bubble',
  LINE: 'line',
  TIN: 'tin',
};

export const CHART_COLORS = {
  bar: '#d4622a',
  scatter: '#1a472a',
  network: '#3b6a9f',
  pie: '#5f7c33',
  treemap: '#5a7d99',
  bubble: '#7b4f9d',
  line: '#4e79a7',
  tin: '#5d8aa8',
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
  bubble: {
    width: 700,
    height: 700,
    margins: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    },
  },
  line: {
    width: 700,
    height: 320,
    margins: {
      top: 20,
      right: 30,
      bottom: 44,
      left: 52,
    },
  },
  tin: {
    width: 700,
    height: 460,
    margins: {
      top: 16,
      right: 16,
      bottom: 44,
      left: 56,
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
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 0,
  topNModes: ['other', 'truncate'],
  defaultTopNMode: 'other',
  otherSliceColor: '#9c9690',
};

export const TREEMAP_CHART = {
  measureModes: ['count', 'sum'],
  defaultMeasureMode: 'count',
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 20,
  paddingOptions: [1, 2, 4],
  defaultPadding: 2,
};

export const LINE_CHART = {
  curveOptions: ['linear', 'monotone', 'step', 'step-before', 'step-after', 'basis', 'cardinal'],
  defaultCurve: 'linear',
  missingModes: ['connect', 'gap', 'interpolate'],
  defaultMissingMode: 'connect',
  strokeWidthOptions: [1, 1.5, 2, 3, 4],
  defaultStrokeWidth: 1.5,
  aggregateModes: ['none', 'mean', 'sum', 'count'],
  defaultAggregateMode: 'none',
  defaultPointsVisible: false,
  defaultSortX: true,
  defaultGhostStrokeColor: '#cccccc',
  pointRadius: 3,
};

export const TIN_CHART = {
  defaultFillMode: 'smooth',
  defaultSubdivisionDepth: 3,
  minSubdivisionDepth: 0,
  maxSubdivisionDepth: 4,
  defaultPointRadius: 3,
  defaultEdgeColor: '#5f5a53',
  defaultHullColor: '#3f3a33',
  defaultShowEdges: true,
  defaultShowPoints: true,
  defaultShowZLabels: false,
  defaultShowHull: false,
  defaultShowIsolines: false,
  defaultIsolineMode: 'count',
  defaultIsolineCount: 5,
  minIsolineCount: 2,
  maxIsolineCount: 20,
  defaultIsolineStep: 1,
  maxIsolineLevels: 200,
  defaultIsolineColor: '#1f2937',
  defaultIsolineWidth: 0.8,
  minIsolineWidth: 0.5,
  maxIsolineWidth: 2,
  defaultColorIsolinesByZ: false,
  defaultIsolineMinColor: '#1e40af',
  defaultIsolineMaxColor: '#dc2626',
  defaultShowIsolineLabels: false,
  defaultIsolineLabelSize: 10,
  minIsolineLabelSize: 8,
  maxIsolineLabelSize: 14,
  defaultIsolineLabelColor: '#1f2937',
  defaultShowThreshold: false,
  defaultThresholdValue: 0,
  defaultThresholdColor: '#dc2626',
  defaultThresholdWidth: 2,
  minThresholdWidth: 0.5,
  maxThresholdWidth: 4,
};

export const BUBBLE_CHART = {
  defaultPadding: 3,
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 10,
  measureModes: ['count', 'sum', 'mean'],
  defaultMeasureMode: 'count',
  labelModes: ['all', 'hover', 'auto'],
  defaultLabelMode: 'auto',
  autoLabelMinRadius: 20,
  nestingModes: ['flat', 'grouped'],
  defaultNestingMode: 'flat',
  defaultNestingColumns: [],
  parentLabelMinRadius: 40,
  zoomTransitionDuration: 600,
  zoomScalePadding: 1.1,
  shallowPaddingBoost: 2,
  deepPaddingMin: 1,
  maxInitialNestingControlsVisible: 1,
};

export const CHART_COLOR_PALETTES = {
  Tableau10: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'],
  Pastel: ['#FFB3BA', '#FFCCCB', '#FFFFBA', '#BAE1BA', '#BAC7FF', '#E0BBE4', '#FFDFD3', '#DFF8EB'],
  Bold: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'],
  'Colorblind-Safe': ['#0173B2', '#029E73', '#ECE133', '#CC78BC', '#CA9161', '#949494', '#ECE2F0', '#A6ACAF'],
};

export const CHART_EMPTY_STATES = {
  noData: 'Sem dados suficientes para este gráfico.',
  logNoPositive: 'Sem valores positivos suficientes para escala log nas colunas selecionadas.',
};
