/**
 * Treemap controls (public facade).
 *
 * Builds the right-sidebar control group for the treemap chart and wires its
 * listeners. The implementation lives in the `treemapControls/` folder, split
 * by responsibility; this file is the single public entry point and keeps the
 * export surface stable for the chart-controls registry in
 * `chartControlsManager.js`.
 *
 *   - builder.js   `createTreeMapControls` (the Data/Display/Styling/Advanced sections)
 *   - listeners.js `setupTreeMapControlListeners` (control wiring + measure/value cross-constraint + color presets)
 *   - defaults.js  `computeDefaults` (first-activation category selection)
 */

export { createTreeMapControls } from './treemapControls/builder.js';
export { setupTreeMapControlListeners } from './treemapControls/listeners.js';
export { computeDefaults } from './treemapControls/defaults.js';
