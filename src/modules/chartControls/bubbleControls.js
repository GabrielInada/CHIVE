/**
 * Bubble-chart controls (public facade).
 *
 * Builds the right-sidebar control group for the bubble chart and wires its
 * listeners. The implementation lives in the `bubbleControls/` folder, split by
 * responsibility; this file is the single public entry point and keeps the export
 * surface stable for `charts/registries/controls.js`.
 *
 *   - builder.js   `createBubbleChartControls` (the Data/Display/Styling sections, incl. progressive nesting)
 *   - listeners.js `setupBubbleChartControlListeners` (control wiring + nesting + measure/value-column cross-constraints)
 *   - defaults.js  `computeDefaults` (first-activation category/value-column selection)
 *
 * The shared, `@internal` `nestingColumns.js` (`resolveNestingColumnsFromConfig`,
 * used by both the builder and the listeners) is intentionally not re-exported here.
 */

export { createBubbleChartControls } from './bubbleControls/builder.js';
export { setupBubbleChartControlListeners } from './bubbleControls/listeners.js';
export { computeDefaults } from './bubbleControls/defaults.js';
