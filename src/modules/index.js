/**
 * CHIVE modules barrel — single import surface for the orchestration layer
 * consumed by `main.js`. Re-exports the state core (appState), the
 * stateSync compatibility shim, and the four user-flow controllers
 * (panel/file/event/UI managers plus feedbackUI).
 *
 * Note: typedefs are not runtime values, so `export *` does not propagate
 * them. Consumers needing project types must import from `src/types.js`
 * directly via `@typedef {import('../types.js').Foo} Foo`.
 *
 * @see CONTRIBUTING.md "Documentation Conventions"
 */
export * from './state/appState.js';
export * from './state/stateSync.js';
export * from './panelManager.js';
export * from './fileManager.js';
export * from './eventHandlers.js';
export * from './feedbackUI.js';
export * from './uiManager.js';