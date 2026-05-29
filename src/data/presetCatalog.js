/**
 * CHIVE bundled preset-dataset catalog.
 *
 * The authoritative list of pre-bundled sample datasets shown in the
 * preset picker dialog. Loaded by `presetService.js` when the user picks
 * an entry. Asset URLs are resolved at module-load time via
 * `new URL(..., import.meta.url)` so they work under any Vite base path.
 *
 * To add a new preset, drop the file into `src/data/`, register a URL
 * constant below, and push an entry onto {@link PRESET_CATALOG} (see
 * the commented template).
 *
 * @typedef {import('../types.js').PresetCatalogEntry} PresetCatalogEntry
 */

const irisCsvUrl = new URL('./presets/dataset-iris.csv', import.meta.url).href;
const amazonianTreesCsvUrl = new URL('./presets/dataset-amazonian-trees.csv', import.meta.url).href;
const amazonMultilevelNestingCsvUrl = new URL('./presets/dataset-amazon-multilevel-nesting.csv', import.meta.url).href;
const monthlyVisitsCsvUrl = new URL('./presets/dataset-monthly-visits.csv', import.meta.url).href;

// Template to append future real datasets from src/data:
// const yourCsvUrl = new URL('./dataset-your-name.csv', import.meta.url).href;
// const yourJsonUrl = new URL('./dataset-your-name.json', import.meta.url).href;
// PRESET_CATALOG.push({
//   id: 'your-id',
//   nameKey: 'chive-preset-your-name',
//   descKey: 'chive-preset-your-desc',
//   rows: 0,
//   columns: 0,
//   tags: ['tag1', 'tag2'],
//   sourceLabel: 'Data source',
//   sourceUrl: 'https://example.com/dataset',
//   sourceLinkLabel: 'Source',
//   dataUrl: yourCsvUrl,
//   dataFormat: 'csv',
// });
// JSON variant: use dataUrl: yourJsonUrl and dataFormat: 'json'.

/**
 * The bundled preset catalog. Entries are rendered in array order in the
 * picker dialog.
 *
 * The `PresetCatalogEntry` typedef notes its fields don't include `rows`/`columns`
 * as derived, these are author-asserted metadata used by the picker dialog
 * to show expected dimensions before the user commits to a load.
 *
 * @type {PresetCatalogEntry[]}
 */
export const PRESET_CATALOG = [
  {
    id: 'iris',
    nameKey: 'chive-preset-iris-name',
    descKey: 'chive-preset-iris-desc',
    rows: 150,
    columns: 6,
    tags: ['classification', 'biology'],
    sourceLabel: 'R. Fisher',
    sourceUrl: 'https://en.wikipedia.org/wiki/Iris_flower_data_set',
    sourceLinkLabel: 'Wikipedia',
    dataUrl: irisCsvUrl,
    dataFormat: 'csv',
  },
  {
    id: 'amazonian-trees',
    nameKey: 'chive-preset-amazonian-trees-name',
    descKey: 'chive-preset-amazonian-trees-desc',
    rows: 40,
    columns: 4,
    tags: ['ecology', 'biology'],
    sourceLabel: 'CHIVE Sample',
    sourceUrl: '',
    sourceLinkLabel: '',
    dataUrl: amazonianTreesCsvUrl,
    dataFormat: 'csv',
  },
  {
    id: 'amazon-multilevel-nesting',
    nameKey: 'chive-preset-amazon-multilevel-nesting-name',
    descKey: 'chive-preset-amazon-multilevel-nesting-desc',
    rows: 48,
    columns: 8,
    tags: ['ecology', 'hierarchy', 'bubble-chart'],
    sourceLabel: 'CHIVE Sample',
    sourceUrl: '',
    sourceLinkLabel: '',
    dataUrl: amazonMultilevelNestingCsvUrl,
    dataFormat: 'csv',
  },
  {
    id: 'monthly-visits',
    nameKey: 'chive-preset-monthly-visits-name',
    descKey: 'chive-preset-monthly-visits-desc',
    rows: 24,
    columns: 3,
    tags: ['time-series', 'line-chart'],
    sourceLabel: 'CHIVE Sample',
    sourceUrl: '',
    sourceLinkLabel: '',
    dataUrl: monthlyVisitsCsvUrl,
    dataFormat: 'csv',
  },
];