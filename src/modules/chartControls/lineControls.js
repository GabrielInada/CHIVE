/**
 * Line-chart controls (public facade).
 *
 * Builds the right-sidebar control group for the line chart and wires its
 * listeners. The implementation lives in the `lineControls/` folder, split by
 * responsibility; this file is the single public entry point and keeps the
 * export surface stable for the chart-controls registry in
 * `chartControlsManager.js`.
 *
 *   - builder.js   `createLineChartControls` (the Data/Styling/Display sections)
 *   - listeners.js `setupLineChartControlListeners` (control wiring + X/Y validation)
 *   - defaults.js  `computeDefaults` (first-activation X/Y selection)
 */

export { createLineChartControls } from './lineControls/builder.js';
export { setupLineChartControlListeners } from './lineControls/listeners.js';
export { computeDefaults } from './lineControls/defaults.js';
