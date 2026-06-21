/**
 * TIN-chart controls (public facade).
 *
 * Builds the right-sidebar control group for the TIN (Triangulated Irregular
 * Network) surface chart and wires its listeners. The TIN chart is the most
 * option-dense: surface fill mode, subdivision depth, isolines, threshold
 * line, multi-color gradient ramps. The implementation lives in the
 * `tinControls/` folder, split by responsibility; this file is the single
 * public entry point and keeps the export surface stable for the
 * chart-controls registry in `chartControlsManager.js`.
 *
 *   - builder.js    `createTinControls` (the Data/Display/Surface/Overlays sections)
 *   - listeners.js  `setupTinControlListeners` (control wiring + cross-constraints)
 *   - defaults.js   `computeDefaults` (first-activation X/Y/Z selection)
 */

export { createTinControls } from './tinControls/builder.js';
export { setupTinControlListeners } from './tinControls/listeners.js';
export { computeDefaults } from './tinControls/defaults.js';
