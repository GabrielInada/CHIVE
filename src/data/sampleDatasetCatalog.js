/**
 * CHIVE bundled sample dataset catalog.
 *
 * The authoritative list of pre-bundled sample datasets shown in the
 * sample dataset picker dialog. Loaded by `sampleDatasetService.js` when the user picks
 * an entry. Asset URLs are resolved at module-load time via
 * `new URL(..., import.meta.url)` so they work under any Vite base path.
 *
 * To add a new sample dataset, drop the file into `src/data/sampleDatasets/`, register a URL
 * constant below, and push an entry onto {@link SAMPLE_DATASET_CATALOG} (see
 * the commented template).
 *
 * @typedef {import('../types.js').SampleDatasetCatalogEntry} SampleDatasetCatalogEntry
 */

const irisCsvUrl = new URL('./sampleDatasets/dataset-iris.csv', import.meta.url).href;
const amazonianTreesCsvUrl = new URL('./sampleDatasets/dataset-amazonian-trees.csv', import.meta.url).href;
const amazonMultilevelNestingCsvUrl = new URL('./sampleDatasets/dataset-amazon-multilevel-nesting.csv', import.meta.url).href;
const monthlyVisitsCsvUrl = new URL('./sampleDatasets/dataset-monthly-visits.csv', import.meta.url).href;
const tinSurfaceCsvUrl = new URL('./sampleDatasets/dataset-tin-surface.csv', import.meta.url).href;

// Template to append future real datasets from src/data/sampleDatasets:
// const yourCsvUrl = new URL('./sampleDatasets/dataset-your-name.csv', import.meta.url).href;
// const yourJsonUrl = new URL('./sampleDatasets/dataset-your-name.json', import.meta.url).href;
// SAMPLE_DATASET_CATALOG.push({
//   id: 'your-id',
//   nameKey: 'chive-sample-dataset-your-name',
//   descKey: 'chive-sample-dataset-your-desc',
//   rowCount: 0,
//   columnCount: 0,
//   tags: ['tag1', 'tag2'],
//   sourceLabel: 'Data source',
//   sourceUrl: 'https://example.com/dataset',
//   sourceLinkLabel: 'Source',
//   dataUrl: yourCsvUrl,
//   dataFormat: 'csv',
//   dropColumns: [],
// });
// JSON variant: use dataUrl: yourJsonUrl and dataFormat: 'json'.

/**
 * The bundled sample dataset catalog. Entries are rendered in array order in the
 * picker dialog.
 *
 * The `SampleDatasetCatalogEntry` typedef notes its fields don't include `rowCount`/`columnCount`
 * as derived, these are author-asserted metadata used by the picker dialog
 * to show expected dimensions before the user commits to a load.
 *
 * @type {SampleDatasetCatalogEntry[]}
 */
export const SAMPLE_DATASET_CATALOG = [
  {
    id: 'iris',
    nameKey: 'chive-sample-dataset-iris-name',
    descKey: 'chive-sample-dataset-iris-desc',
    rowCount: 150,
    columnCount: 6,
    tags: ['classification', 'biology'],
    sourceLabel: 'R. Fisher',
    sourceUrl: 'https://en.wikipedia.org/wiki/Iris_flower_data_set',
    sourceLinkLabel: 'Wikipedia',
    dataUrl: irisCsvUrl,
    dataFormat: 'csv',
  },
  {
    id: 'amazonian-trees',
    nameKey: 'chive-sample-dataset-amazonian-trees-name',
    descKey: 'chive-sample-dataset-amazonian-trees-desc',
    rowCount: 40,
    columnCount: 4,
    tags: ['ecology', 'biology'],
    sourceLabel: 'CHIVE Sample',
    sourceUrl: '',
    sourceLinkLabel: '',
    dataUrl: amazonianTreesCsvUrl,
    dataFormat: 'csv',
  },
  {
    id: 'amazon-multilevel-nesting',
    nameKey: 'chive-sample-dataset-amazon-multilevel-nesting-name',
    descKey: 'chive-sample-dataset-amazon-multilevel-nesting-desc',
    rowCount: 48,
    columnCount: 8,
    tags: ['ecology', 'hierarchy', 'bubble-chart'],
    sourceLabel: 'CHIVE Sample',
    sourceUrl: '',
    sourceLinkLabel: '',
    dataUrl: amazonMultilevelNestingCsvUrl,
    dataFormat: 'csv',
  },
  {
    id: 'monthly-visits',
    nameKey: 'chive-sample-dataset-monthly-visits-name',
    descKey: 'chive-sample-dataset-monthly-visits-desc',
    rowCount: 24,
    columnCount: 3,
    tags: ['time-series', 'line-chart'],
    sourceLabel: 'CHIVE Sample',
    sourceUrl: '',
    sourceLinkLabel: '',
    dataUrl: monthlyVisitsCsvUrl,
    dataFormat: 'csv',
  },
  {
    id: 'tin-surface',
    nameKey: 'chive-sample-dataset-tin-surface-name',
    descKey: 'chive-sample-dataset-tin-surface-desc',
    rowCount: 600,
    columnCount: 3,
    tags: ['terrain', 'surface', 'tin-chart'],
    sourceLabel: 'CHIVE Sample',
    sourceUrl: '',
    sourceLinkLabel: '',
    dataUrl: tinSurfaceCsvUrl,
    dataFormat: 'csv',
  },
];
