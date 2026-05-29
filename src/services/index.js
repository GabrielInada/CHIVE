/**
 * CHIVE services barrel, partial by design.
 *
 * Only the broadly-consumed services are re-exported here ([i18nService](./i18nService.js)
 * and [dataService](./dataService.js)). The remaining services are imported by
 * their full path from the specific orchestrators that own them:
 *   - [dataIngestService](./dataIngestService.js)   ← [fileManager.js](../modules/fileManager.js)
 *   - [persistenceService](./persistenceService.js) ← [main.js](../main.js)
 *   - [presetService](./presetService.js)            ← [presetDatasetsView.js](../components/results/presetDatasetsView.js)
 *
 * Keeping the barrel partial makes the dependency graph easier to read at a
 * glance (every barrel re-export is a candidate import-from-anywhere).
 */

export * from './i18nService.js';
export * from './dataService.js';