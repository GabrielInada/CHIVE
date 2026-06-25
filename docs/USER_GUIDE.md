# CHIVE User Guide

This guide covers the normal CHIVE workflow from loading data through exporting
work. For setup, deployment, and contributor details, use the README and the
developer docs.

## Load Data

Start from either a bundled sample dataset or a local file.

- Use **Load sample dataset** when you want a quick example for charts, filters,
  joins, or panel export. Samples are bundled static files, so they load from
  the same host as CHIVE.
- Upload CSV-like text files (`.csv`, `.tsv`, `.dsv`, `.txt`) or JSON files
  from your machine. CSV-like files use delimiter detection for comma,
  semicolon, tab, and pipe separators. JSON files must be a top-level array of
  row objects or an object containing one array-valued property.
- CHIVE parses uploaded files in the browser. Data ingest uses a Web Worker so
  larger files do not block the main UI thread.

After a dataset loads, CHIVE shows the table preview, detected columns, and
column controls. Hide columns you do not want available to charts.

## Review Data

Use the preview and statistics views before building charts.

- The table preview shows the active dataset using the selected visible columns.
- Numeric summaries include distribution values such as minimum, maximum, mean,
  and median.
- Categorical summaries show missingness, distinct values, mode, and top values.
- Detected column types are `number`, `text`, or `date`; chart controls use
  those types to decide which columns are valid choices.

If a dataset needs to combine fields from two loaded datasets, use the join
builder and choose the join keys, join type, and output columns.

## Build Charts

Open the chart view and select one chart type at a time. CHIVE supports bar,
scatter, pie/donut, bubble, network, treemap, line, and TIN charts.

- Choose the required columns first. If required data is missing, the chart area
  shows an empty-state message that names what to fix.
- Use the sidebar controls for aggregation, colors, labels, sorting, limits,
  axes, and chart-specific options.
- Use global filters to focus the active dataset before charting. Global filters
  apply before every chart reads the rows.
- Chart edits affect the active dataset's current chart configuration. Charts
  already saved to the dashboard panel stay frozen until you add them again.

For exact column requirements and chart-specific empty states, see
[Chart and data reference](CHART_REFERENCE.md).

## Build A Dashboard Panel

Add useful chart states to the dashboard panel when you want a composed output.

- Adding a chart snapshots the current filtered rows, visible columns, chart
  type, and chart configuration.
- Arrange chart snapshots into panel blocks and slots.
- Change panel block templates, proportions, height, and borders from the panel
  controls.
- Export the panel as SVG when you need a static graphic.

Panel snapshots are intentionally independent of later dataset edits. Re-add a
chart when you want the panel to reflect updated data, filters, or settings.

## Save, Import, And Export Projects

CHIVE auto-saves browser work and can also transfer project files manually.

- Auto-save stores one SQLite byte image in IndexedDB for the current origin.
  UI preferences and the selected locale are stored in `localStorage`.
- Full project export downloads a `.chive.sqlite3` file containing datasets,
  chart snapshots, and panel layout.
- Work-only export downloads the same project format without dataset rows or
  saved chart row payloads. Use it for layout/work transfer when row data should
  not be included.
- Project import currently accepts full project files. Import replaces the
  current datasets and panel after confirmation.

Different deployment URLs and local development ports have separate browser
storage because browsers scope storage by origin.

## Privacy Basics

CHIVE has no application backend in the default static deployments. Uploaded
datasets are parsed, visualized, auto-saved, imported, and exported in the
browser.

The browser still must trust the static host serving CHIVE, the vendored runtime
JavaScript and fonts, the browser itself, installed extensions, and local device
policies. For sensitive or regulated datasets, self-host CHIVE from an
environment you control and review the trust model in
[Privacy and security](PRIVACY_AND_SECURITY.md).
