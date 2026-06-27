# Preset Dataset Contributor Guide

This guide documents how to add or update the bundled sample datasets shown by
CHIVE's "Load sample dataset" dialog.

| Field | Value |
|---|---|
| Audience | Contributors adding or updating bundled sample datasets. |
| Source of truth | Preset file placement, catalog metadata, source attribution, translation keys, and row/column expectations. |
| Update when | Preset catalog fields, bundled dataset files, sample metadata, source links, or preset i18n behavior change. |

## Purpose

Preset datasets give users immediate examples for testing uploads, table
preview, statistics, charts, joins, filters, and panel export without requiring
their own files. Keep presets small enough to load quickly in the browser and
specific enough to demonstrate at least one chart workflow well.

## Accepted Formats

CSV is the default format. JSON is also supported when the catalog entry sets
`dataFormat: 'json'`.

Use CSV unless JSON is necessary for the example. Preset files are parsed by
the same ingest path as user uploads, so the loaded row and column counts should
match what a user would see after uploading the file manually.

## File Placement

Put bundled preset files in:

```text
src/data/presets/
```

Use descriptive lowercase filenames, for example:

```text
src/data/presets/dataset-example-name.csv
```

Do not use remote URLs for the default bundled catalog unless maintainers have
explicitly accepted the network dependency. Bundled files work with CHIVE's
static deployment model and are easier to smoke-test.

## Catalog Registration

Register the file in `src/data/presetCatalog.js` with `new URL(...,
import.meta.url).href`:

```js
const exampleCsvUrl = new URL('./presets/dataset-example-name.csv', import.meta.url).href;
```

Then add an entry to `PRESET_CATALOG`:

```js
{
	id: 'example-name',
	nameKey: 'chive-preset-example-name',
	descKey: 'chive-preset-example-desc',
	rows: 42,
	columns: 5,
	tags: ['example', 'line-chart'],
	sourceLabel: 'Data provider',
	sourceUrl: 'https://example.com/dataset',
	sourceLinkLabel: 'Source',
	dataUrl: exampleCsvUrl,
	dataFormat: 'csv',
}
```

Entries render in array order in the preset picker dialog.

## Metadata Fields

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Stable lowercase identifier. Do not rename after release unless migration is intentional. |
| `nameKey` | Yes | i18n key for the preset display name. |
| `descKey` | Yes | i18n key for the preset description. |
| `rows` | Yes | Expected row count after parsing and any dropped columns. |
| `columns` | Yes | Expected column count after parsing and any dropped columns. |
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

Every preset needs a display name and description in all translation files:

- `src/i18n/en.json`
- `src/i18n/pt-BR.json`
- `src/i18n/qqq.json`

Preset keys should follow the existing pattern:

```json
"chive-preset-example-name": "Example Dataset",
"chive-preset-example-desc": "Short description of what this dataset demonstrates."
```

In `qqq.json`, explain where the text appears and what workflow the sample is
meant to support. Follow the translation workflow in
[Translation Contributor Guide](i18n.md).

## Validation Checklist

- The file is in `src/data/presets/`.
- The catalog uses `new URL('./presets/...', import.meta.url).href`.
- `rows` and `columns` match the loaded dataset after parsing.
- `nameKey` and `descKey` exist in every locale file.
- Source attribution is accurate and the source link opens in a new tab when
  present.
- The preset loads from the browser dialog without console errors.
- At least one relevant chart renders with the preset.
- `npm run lint` passes.
- `npm test` passes.
