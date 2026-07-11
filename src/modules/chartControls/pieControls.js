/**
 * Pie-chart controls (public facade).
 *
 * Builds the right-sidebar control group for the pie chart and wires its
 * listeners. The implementation lives in the `pieControls/` folder, split by
 * responsibility; this file is the single public entry point and keeps the
 * export surface stable for `charts/registries/controls.js`.
 *
 *   - builder.js      `createPieChartControls` (the Data/Display/Styling sections)
 *   - listeners.js    `setupPieChartControlListeners` (control wiring + cross-constraints)
 *   - defaults.js     `computeDefaults` (first-activation column selection)
 *   - sectorValues.js `getPieSectorValues` (package-private; shared sector ordering)
 */

export { createPieChartControls } from './pieControls/builder.js';
export { setupPieChartControlListeners } from './pieControls/listeners.js';
export { computeDefaults } from './pieControls/defaults.js';
