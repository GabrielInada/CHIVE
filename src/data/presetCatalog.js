const irisCsvUrl = new URL('./dataset-iris.csv', import.meta.url).href;

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
];