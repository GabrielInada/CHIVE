# Sample Dataset Contributor Guide

This guide documents how to add or update the bundled sample datasets shown by
CHIVE's "Load sample dataset" dialog.

| Field | Value |
|---|---|
| Audience | Contributors adding or updating bundled sample datasets. |
| Source of truth | Sample dataset file placement, catalog metadata, source attribution, translation keys, and row/column expectations. |
| Update when | Sample dataset catalog fields, bundled dataset files, sample metadata, source links, or sample dataset i18n behavior change. |

## Purpose

Sample datasets give users immediate examples for testing uploads, table
preview, statistics, charts, joins, filters, and panel export without requiring
their own files. Keep sample datasets small enough to load quickly in the browser and
specific enough to demonstrate at least one chart workflow well.

## Accepted Formats

CSV is the default format. JSON is also supported when the catalog entry sets
`dataFormat: 'json'`.

Use CSV unless JSON is necessary for the example. Sample dataset files are parsed by
the same ingest path as user uploads, so the loaded row and column counts should
match what a user would see after uploading the file manually.

## File Placement

Put bundled sample dataset files in:

```text
src/data/sampleDatasets/
```

Use descriptive lowercase filenames, for example:

```text
src/data/sampleDatasets/dataset-example-name.csv
```

Do not use remote URLs for the default bundled catalog unless maintainers have
explicitly accepted the network dependency. Bundled files work with CHIVE's
static deployment model and are easier to smoke-test.

## Catalog Registration

Register the file in `src/data/sampleDatasetCatalog.js` with `new URL(...,
import.meta.url).href`:

```js
const exampleCsvUrl = new URL('./sampleDatasets/dataset-example-name.csv', import.meta.url).href;
```

Then add an entry to `SAMPLE_DATASET_CATALOG`:

```js
{
	id: 'example-name',
	nameKey: 'chive-sample-dataset-example-name',
	descKey: 'chive-sample-dataset-example-desc',
	rowCount: 42,
	columnCount: 5,
	tags: ['example', 'line-chart'],
	sourceLabel: 'Data provider',
	sourceUrl: 'https://example.com/dataset',
	sourceLinkLabel: 'Source',
	dataUrl: exampleCsvUrl,
	dataFormat: 'csv',
}
```

Entries render in array order in the sample dataset picker dialog.

## Metadata Fields

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Stable lowercase identifier. Do not rename after release unless migration is intentional. |
| `nameKey` | Yes | i18n key for the sample dataset display name. |
| `descKey` | Yes | i18n key for the sample dataset description. |
| `rowCount` | Yes | Expected row count after parsing and any dropped columns. |
| `columnCount` | Yes | Expected column count after parsing and any dropped columns. |
| `tags` | Yes | Short category tags for maintainers and future filtering/search. |
| `sourceLabel` | Yes | Human-readable attribution. Use `CHIVE Sample` for original synthetic examples. |
| `sourceUrl` | Yes | Original source URL when available; use an empty string for project-created samples with no external source. |
| `sourceLinkLabel` | Yes | Link text shown for `sourceUrl`; may be empty when `sourceUrl` is empty. |
| `dataUrl` | Yes | URL constant resolved with `new URL(..., import.meta.url).href`. |
| `dataFormat` | Yes | `'csv'` or `'json'`. CSV is preferred. |
| `dropColumns` | No | Array of column names to remove before type detection and normalization. |

`dropColumns` is useful when a source file contains helper columns that should
not appear in CHIVE. Prefer curating the bundled file itself when possible; use
`dropColumns` when preserving the original source structure is important.

## Translation Requirements

Every sample dataset needs a display name and description in all translation files:

- `src/i18n/en.json`
- `src/i18n/pt-BR.json`
- `src/i18n/qqq.json`

Sample dataset keys should follow the existing pattern:

```json
"chive-sample-dataset-example-name": "Example Dataset",
"chive-sample-dataset-example-desc": "Short description of what this dataset demonstrates."
```

In `qqq.json`, explain where the text appears and what workflow the sample is
meant to support. Follow the translation workflow in
[Translation Contributor Guide](i18n.md).

## Loading Failures

The sample-loading workflow reports the same localized message in its progress
toast and error notice. Fetch, HTTP, and unexpected failures name the sample
without exposing internal reason codes or exception text. Timeouts retain their
specific explanation, and known parsing failures include translated details.
Unknown ingest failures use the generic sample-loading message. Cancellation
during either fetching or ingest closes the toast quietly and adds no dataset.
A missing sample dataset descriptor shows an unnamed error notice without a progress toast.

Samples load through the same intake as uploads and joins
(`src/features/datasetWorkspace/workflows/intake.js`), which owns the toast,
cancellation, and failure feedback above. Unlike uploads and joins, samples skip
the row-limit warning, so keep bundled datasets small.

## Validation Checklist

- The file is in `src/data/sampleDatasets/`.
- The catalog uses `new URL('./sampleDatasets/...', import.meta.url).href`.
- `rowCount` and `columnCount` match the loaded dataset after parsing.
- `nameKey` and `descKey` exist in every locale file.
- Source attribution is accurate and the source link opens in a new tab when
  present.
- The sample dataset loads from the browser dialog without console errors.
- At least one relevant chart renders with the sample dataset.
- `npm run lint` passes.
- `npm test` passes.
