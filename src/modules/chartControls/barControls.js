/**
 * Bar-chart controls (public facade).
 *
 * Builds the right-sidebar control group for the bar chart and wires its
 * listeners. The implementation lives in the `barControls/` folder, split by
 * responsibility; this file is the single public entry point and keeps the
 * export surface stable for the chart-controls registry in
 * `chartControlsManager.js`.
 *
 *   - builder.js   `createBarChartControls` (the Data/Display/Styling/Advanced sections)
 *   - listeners.js `setupBarChartControlListeners` (control wiring + measure/value-column cross-constraints)
 *   - defaults.js  `computeDefaults` (first-activation category selection)
 */

export { createBarChartControls } from './barControls/builder.js';
export { setupBarChartControlListeners } from './barControls/listeners.js';
export { computeDefaults } from './barControls/defaults.js';
