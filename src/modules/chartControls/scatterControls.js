/**
 * Scatter-plot controls (public facade).
 *
 * Builds the right-sidebar control group for the scatter plot and wires its
 * listeners. The implementation lives in the `scatterControls/` folder, split
 * by responsibility; this file is the single public entry point and keeps the
 * export surface stable for `charts/registries/controls.js`.
 *
 *   - builder.js   `createScatterPlotControls` (the Data/Display/Analytics/Styling sections)
 *   - listeners.js `setupScatterPlotControlListeners` (control wiring + cross-constraints)
 *   - defaults.js  `computeDefaults` (first-activation column/scale selection)
 */

export { createScatterPlotControls } from './scatterControls/builder.js';
export { setupScatterPlotControlListeners } from './scatterControls/listeners.js';
export { computeDefaults } from './scatterControls/defaults.js';
