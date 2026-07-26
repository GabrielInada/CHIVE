# CHIVE User Guide

This guide covers the normal CHIVE workflow from loading data through exporting
work. For setup, deployment, and contributor details, use the README and the
developer docs.

| Field | Value |
|---|---|
| Audience | People using CHIVE in the browser. |
| Source of truth | User workflow, supported file flows, browser settings, charting path, panel workflow, and practical limitations. |
| Update when | Upload, settings, charting, filtering, panel, import/export, or visible privacy behavior changes. |

## Load Data

Start from either a bundled sample dataset or a local file.

- Use **Load sample dataset** when you want a quick example for charts, filters,
  joins, or panel export. Samples are bundled static files, so they load from
  the same host as CHIVE.
- Upload CSV-like text files (`.csv`, `.tsv`, `.dsv`, `.txt`) or JSON files
  from your machine. CSV-like files use delimiter detection for comma,
  semicolon, tab, and pipe separators. JSON files must be a top-level array of
  row objects or an object with at least one array-valued property; when more
  than one exists, CHIVE uses the first one in object-key order.
- CHIVE parses uploaded files in the browser. Data ingest uses a Web Worker so
  larger files do not block the main UI thread.
- Files larger than 15 MB require confirmation before processing. Ingest keeps
  at most the first 200,000 rows from a file.

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
scatter, 3D scatter, pie/donut, bubble, network, treemap, line, and TIN
charts.

- Choose the required columns first. If required data is missing, the chart area
  shows an empty-state message that names what to fix.
- Use the sidebar controls for aggregation, colors, labels, sorting, limits,
  axes, and chart-specific options.
- Use global filters to focus the active dataset before charting. Global filters
  apply before every chart reads the rows.
- Chart edits affect the active dataset's current chart configuration. Charts
  already saved to the dashboard panel remain unchanged until you add them again.

For exact column requirements and chart-specific empty states, see
[Chart and data reference](chart-reference.md).

## Browser Settings

Use the settings button in the header to change preferences that apply to the
current browser and deployment URL.

- **General** contains the interface language.
- **Performance** contains the TIN color-rendering mode. **Optimized** is the
  default and limits the surface to 128 color groups. **Full ramp** preserves
  each computed ramp color but can create more SVG paths and render or export
  more slowly. Both modes keep the adaptive surface-detail limit.
- **Storage** reports how much browser storage the site uses and whether stored
  projects are protected from automatic eviction, and can ask the browser for
  that protection.
- **Data** clears the project stored in this browser after a confirmation. Your
  language and app settings are kept. This section is on the application page
  only.

Changes apply immediately. The TIN preference survives reloads and remains
separate from saved project data, but clearing this site's browser data removes
it. It is not included in project imports, exports, or panel snapshots. See the
[TIN chart deep dive](../development/charts/tin.md#82-browser-local-rendering-mode-tradeoff)
for the implementation tradeoff and [Privacy and security](privacy-security.md)
for storage details.

## Build A Dashboard Panel

Add useful chart states to the dashboard panel when you want a composed output.

- Adding a chart snapshots the current filtered rows, visible columns, chart
  type, and chart configuration.
- Arrange chart snapshots into panel blocks and slots.
- Change panel block templates, proportions, height, and borders from the panel
  controls.
- Export the panel as SVG when you need a static graphic. Canvas-based
  charts (the 3D scatter) have no SVG output yet: the export completes
  without them and tells you how many were left out.

Panel snapshots are intentionally independent of later dataset edits. Re-add a
chart when you want the panel to reflect updated data, filters, or settings.

## Save, Import, And Export Projects

CHIVE auto-saves browser work and can also transfer project files manually.

- Auto-save keeps work in browser storage for the current origin.
- Full project export downloads a `.chive.sqlite3` file containing datasets,
  chart snapshots, and panel layout.
- Work-only export downloads the same project format without dataset rows or
  saved chart row payloads. It is a row-free metadata and layout snapshot for
  external inspection or archival; CHIVE does not currently import it.
- Project import restores a full project file and replaces the current datasets
  and panel after confirmation.

Different deployment URLs and local development ports have separate browser
storage because browsers scope storage by origin.

For exact storage keys, payload contents, and trust boundaries, see
[Privacy and security](privacy-security.md).

## Known Limitations

- Project import currently accepts full project files. Work-only project files
  are export-only.
- CHIVE does not currently bundle a network preset. Use the manual CSV example
  in [Chart and data reference](chart-reference.md#csv-examples-for-network-and-tin).
- Scatter date columns currently classify as categorical axes. See the
  [scatter chart deep dive](../development/charts/scatter.md#22-axis-types-numeric-vs-categorical)
  for the current axis behavior.
- TIN is a visualization tool for scattered points, not a GIS/DEM engine. It
  does not model CRS, projection, or uncertainty. See the
  [TIN chart deep dive](../development/charts/tin.md#known-limitations-and-non-claims).
- The optional Docker deployment keeps a documented CSP exception required by
  D3 CSV parsing. See [Docker deployment](../deployment/docker.md).

## Privacy Basics

CHIVE's default static deployments do not use a remote or server-side
application backend. Uploaded datasets are parsed, visualized, auto-saved,
imported, and exported in the browser.

The browser still must trust the static host serving CHIVE, the vendored runtime
JavaScript and fonts, the browser itself, installed extensions, and local device
policies. For sensitive or regulated datasets, self-host CHIVE from an
environment you control and review the trust model in
[Privacy and security](privacy-security.md).
