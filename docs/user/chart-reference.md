# Chart and Data Reference

This reference tells you which columns and settings each CHIVE chart expects, so you
can pick the right chart for a dataset and understand why a chart shows an empty state
instead of a visualization.

| Field | Value |
|---|---|
| Audience | CHIVE users choosing chart types and diagnosing chart empty states. |
| Source of truth | User-facing chart requirements, chart options, aggregation behavior, sample choices, and empty-state messages. |
| Update when | Chart controls, required columns, aggregation modes, empty-state keys, or bundled chart samples change. |

## Purpose

CHIVE charts render from the columns you select in the sidebar. When required columns
are missing, or a mode needs data the column does not have, the chart area shows a short
message instead of a drawing. This document lists, per chart type, the required data, the
optional settings, how aggregation works, and the exact empty-state messages you may see.

For the bundled sample datasets referenced below, see the
[Preset dataset contributor guide](../development/preset-datasets.md). For how chart data is snapshotted
into the dashboard panel, see the [Architecture reference](../development/architecture-reference.md).

For an in-depth, code-level walkthrough of a single chart (the underlying math or algorithm,
the renderer internals, the controls, and the tests), see the per-chart
[chart deep dives](../development/charts/README.md).

## Data model overview

- **Rows and columns.** An uploaded CSV/JSON becomes rows of named columns.
- **Detected types.** Each column is detected as one of `number`, `text`, or `date`
  (detection rules in `src/config/types.js`). Type detection drives which charts and modes
  a column can satisfy: numeric aggregation and axes need `number`; date axes need `date`.
- **Visible columns vs. all columns.** Charts only consider columns marked visible in the
  column controls. Hiding a column removes it from the chart's available choices.
- **Missing values.** Empty cells (null, undefined, or empty string) are treated as a single
  missing bucket rather than many distinct values. Categorical grouping collapses them to an
  `N/A` group, and the filter dialog shows them as `(missing)`.

## Chart selection matrix

Required columns and behavior below are taken from the renderers in
`src/modules/visualizations/` and the controls in `src/modules/chartControls/`.

| Chart | Required | Optional | Best for | Sample dataset |
|---|---|---|---|---|
| Bar | Category column (+ numeric value column for sum/mean) | Sort, top N, color mode, axis labels | Comparing categories | Iris, Amazonian Trees |
| Scatter | X column, Y column | Size field, color field, log scale, regression, categorical-pair mode | Relationships and clusters | Iris |
| 3D scatter | Numeric X, Y, and Z columns | Point size, opacity, color | Relationships across three numeric variables | Terrain Surface, Iris |
| Pie / Donut | Category column (+ numeric value column for sum) | Inner/outer radius, top N, labels, legend | Part-to-whole summaries | Iris |
| Bubble | Category column (+ nesting columns when grouped; numeric value column for sum/mean) | Nesting mode, top N, labels, color scheme | Group size and hierarchy | Amazon Multi-level Nesting, Amazonian Trees |
| Network | Source column, target column | Weight column, group column, physics and zoom | Relationships between entities | None bundled; see [CSV examples](#csv-examples-for-network-and-tin) |
| Treemap | Category column (+ numeric value column for sum) | Top N, labels, color mode | Hierarchical composition | Amazonian Trees |
| Line | X column (any type) + numeric Y column | Axis type, curve, missing-value mode, aggregate mode, sort X | Time series and trends | Monthly Visits |
| TIN | Numeric X, Y, and Z columns | Color ramp, isolines, threshold, edges/points/hull | Terrain and surface interpolation | Terrain Surface |

## Per-chart reference

### Bar chart

- **Best for:** comparing a measure across categories.
- **Deep dive:** [bar.md](../development/charts/bar.md) for the renderer internals, math, and tests.
- **Required data:** a category column. In `count` mode (default) that is all you need.
- **Optional settings:** sort order, top N, color mode (uniform / gradient), X and Y axis
  label toggles.
- **Aggregation behavior:** `count` counts rows per category. `sum` and `mean` require a
  numeric value column and aggregate that column per category. Signed values are allowed,
  but bar sum/mean mode is clearest for measures that compare from a zero baseline.
- **Good sample dataset:** Iris (category `Species`), Amazonian Trees (`family` with
  `abundance` or `biomass_kg`).
- **Common empty states:** no category selected; `sum`/`mean` selected without a numeric
  value column.

### Scatter plot

- **Best for:** relationships, correlation, and cluster spotting between two columns.
- **Deep dive:** [scatter.md](../development/charts/scatter.md) for the renderer internals, math, and tests.
- **Required data:** an X column and a Y column. Each may be numeric or categorical.
- **Optional settings:** linear/log scale per axis, point radius and opacity, a size field,
  a color field with uniform / numeric / category color modes, categorical-pair mode
  (jitter or aggregate), and a regression overlay.
- **Aggregation behavior:** numeric X/Y plot points directly; a categorical axis can jitter
  points or aggregate them per category pair. Log scale drops values at or below zero.
  Regression needs both axes numeric and at least two points.
- **Good sample dataset:** Iris (e.g. `PetalLengthCm` vs `PetalWidthCm`, colored by
  `Species`).
- **Common empty states:** fewer than two columns selected; not enough positive values for
  a log axis.

### Pie / donut chart

- **Best for:** part-to-whole summaries across a handful of categories.
- **Deep dive:** [pie.md](../development/charts/pie.md) for the renderer internals, geometry, and tests.
- **Required data:** a categorical column. `count` mode (default) needs nothing more.
- **Optional settings:** inner radius (pie vs donut), outer radius, pad angle, top N with an
  "other" or truncate mode, category/value labels, legend, per-slice color overrides.
- **Aggregation behavior:** `count` sizes slices by row count; `sum` sizes them by a numeric
  value column. Use non-negative values for meaningful part-to-whole pies; zero or negative
  category sums are not filtered before the D3 pie layout.
- **Good sample dataset:** Iris (`Species`).
- **Common empty states:** no categorical column; `sum` mode without a numeric value column.

### Bubble chart

- **Best for:** showing group size and, optionally, nested hierarchy.
- **Deep dive:** [bubble.md](../development/charts/bubble.md) for circle packing, nesting, and tests.
- **Required data:** a category column. Grouped nesting additionally requires at least one
  nesting column.
- **Optional settings:** measure mode, value column, top N, padding, label mode
  (all / hover / auto), nesting mode (flat / grouped), nesting columns for progressive
  hierarchy, color scheme.
- **Aggregation behavior:** `count` sizes bubbles by row count; `sum`/`mean` size them by a
  numeric value column. Use non-negative values when bubble area should encode magnitude. In
  grouped nesting mode the nesting columns define the hierarchy and drill-down.
- **Good sample dataset:** Amazon Multi-level Nesting (`ecoregion → forestType → family →
  genus` with `abundance`), Amazonian Trees for a flat view.
- **Common empty states:** no category; `sum`/`mean` without a numeric value column; grouped
  mode without a nesting column.

### Network graph

- **Best for:** relationships between entities as nodes and edges.
- **Deep dive:** [network.md](../development/charts/network.md) for the force simulation and tests.
- **Required data:** a source column and a target column. Each row is one edge between two
  node identifiers.
- **Optional settings:** a numeric weight column (defaults to 1 when absent), a group column
  that colors nodes, plus physics and zoom controls (node radius, link distance, charge,
  link opacity, alpha decay, zoom scale), node labels, legend, and edge color mode.
- **Aggregation behavior:** nodes are derived from the distinct source/target values; edges
  come from the rows.
- **Good sample dataset:** none bundled. Use the
  [network CSV example](#csv-examples-for-network-and-tin).
- **Common empty states:** missing source or target column; no usable nodes or edges after
  parsing.

### Treemap chart

- **Best for:** hierarchical composition where area encodes magnitude.
- **Deep dive:** [treemap.md](../development/charts/treemap.md) for squarified tiling and tests.
- **Required data:** a category column. `count` mode (default) needs nothing more.
- **Optional settings:** top N, padding, label and value toggles, color mode
  (scheme / uniform), color scheme.
- **Aggregation behavior:** `count` sizes cells by row count; `sum` sizes them by a numeric
  value column.
- **Good sample dataset:** Amazonian Trees (`family` sized by `biomass_kg`).
- **Common empty states:** no category; `sum` mode without a numeric value column.

### Line chart

- **Best for:** time series and ordered trends.
- **Deep dive:** [line.md](../development/charts/line.md) for curves, missing-value modes, and tests.
- **Required data:** an X column (date, numeric, or categorical) and a numeric Y column.
- **Optional settings:** X axis type, curve (linear / monotone / step variants / basis /
  cardinal), missing-value mode (connect / gap / interpolate), aggregate mode, sort X, point
  markers, stroke width, color, axis labels.
- **Aggregation behavior:** with `aggregateMode` none, points are plotted as-is. `count`,
  `sum`, and `mean` group points by X value. Date X values are parsed as dates; invalid
  dates are skipped.
- **Good sample dataset:** Monthly Visits (`month` as date X, `visits` as Y; includes one
  intentional missing value to exercise the missing-value modes).
- **Common empty states:** missing X or Y; no finite Y values; no usable X values.

### 3D scatter chart

- **Best for:** relationships and clusters across three numeric variables, as a rotatable
  WebGL point cloud (drag to rotate, scroll to zoom; arrow keys rotate, `+`/`-` zoom,
  `Home` resets the camera).
- **Deep dive:** [scatter3d.md](../development/charts/scatter3d.md) for the per-chart
  package layout, sampling, and lifecycle.
- **Required data:** numeric X, Y, and Z columns. Z maps to the vertical axis.
- **Optional settings:** point size, point opacity, point color, custom title.
- **Aggregation behavior:** none. Every row with finite X, Y, and Z is a point. Very large
  datasets are sampled down to a render budget (the chart says how many of the valid points
  it is showing; the rows carrying each axis minimum and maximum are always kept).
- **Good sample dataset:** Terrain Surface (`x`, `y`, `z`), or Iris with three numeric
  measurements.
- **Pilot limitations:** requires WebGL; no SVG download button (panel exports omit it and
  say so); no hover tooltips yet; pinch-zoom on touch devices is not supported (drag-rotate
  works).
- **Common empty states:** any of X/Y/Z missing; no rows with finite values in all three;
  WebGL unavailable in the browser.

### TIN chart

- **Best for:** terrain and continuous-surface interpolation from scattered points.
- **Deep dive:** [tin.md](../development/charts/tin.md) for triangulation, interpolation, and tests.
- **Required data:** numeric X, Y, and Z columns. X and Y are coordinates; Z is the surface
  value.
- **Optional settings:** fill mode (smooth / flat), subdivision depth, color ramp presets
  (viridis, plasma, magma, inferno, turbo, grays, terrain, custom), gradient colors and
  distribution, isolines, threshold line, edges, points, hull, and Z labels.
- **Aggregation behavior:** none. Every qualifying row is a vertex. Triangulation needs at
  least three points with finite X, Y, and Z.
- **Good sample dataset:** Terrain Surface (`x`, `y`, `z`), a bundled synthetic sample
  registered as `tin-surface`.
- **Common empty states:** any of X/Y/Z missing; fewer than three finite points.

## Filters and chart data

- **Global filters.** The global filter applies a multi-rule pipeline to the active dataset
  before any chart reads it (`src/utils/globalFilter.js`, with single-rule primitives in
  `src/utils/chartFilters.js`). A categorical rule includes or excludes values; a numeric
  rule filters by range or comparison. Charts always render the filtered rows.
- **Missing-value bucket.** Missing values do not fragment a categorical series: they
  collapse into one bucket, labeled `N/A` in grouping and `(missing)` in the filter dialog.
- **Panel snapshots.** Adding a chart to the dashboard panel snapshots the current
  global-filtered rows and visible columns alongside the chart type and config
  (`panelManager.addChartToPanel`). Later edits to the dataset or filters do not retro-change
  a chart already placed on the panel until it is re-added.

## Common empty states

When a chart cannot render, the chart area shows one of these messages. The message names
exactly what to fix.

| Condition | Message |
|---|---|
| Bar: no visible column | Select at least one visible column to build the bar chart. |
| Bar: sum/mean without numeric | Select a numeric value column to render the bar chart in sum or mean mode. |
| Scatter: fewer than two columns | Select two visible columns to build the scatter plot. |
| Scatter: log axis without positives | Not enough positive numeric values for log scale on selected axes. |
| Pie: no categorical column | Select at least one visible categorical column to build the pie/donut chart. |
| Pie: sum without numeric | Select a visible numeric value column to render pie/donut in sum mode. |
| Bubble: no categorical column | Select at least one visible categorical column to build the bubble chart. |
| Bubble: sum/mean without numeric | Select a visible numeric value column to render the bubble chart in sum or mean mode. |
| Bubble: grouped without nesting | Select at least one nesting column for grouped mode. |
| Treemap: no categorical column | Select at least one visible categorical column to build the treemap. |
| Treemap: sum without numeric | Select a numeric column to render the treemap in sum mode. |
| Network: no source/target | Select valid source and target columns to render the network graph. |
| Line: no X or numeric Y | Select an X column and a numeric Y column to render the line chart. |
| Line: no finite Y | Select a numeric Y column with finite values to render the line chart. |
| Line: no usable X | No usable X values in the selected column. |
| TIN: X/Y/Z missing | Select valid numeric X, Y and Z columns to render the TIN. |
| TIN: fewer than three points | Need at least 3 rows with finite X, Y and Z values to triangulate a terrain. |
| 3D scatter: X/Y/Z missing | Select numeric X, Y and Z columns to render the 3D scatter. |
| 3D scatter: no finite rows | No rows with finite X, Y and Z values to plot. |
| 3D scatter: no WebGL | 3D rendering is unavailable in this browser (WebGL is required). |
| No chart selected | No visualization selected. |

These strings live in `src/i18n/en.json` (keys `chive-chart-empty-*`); the Portuguese
versions are in `src/i18n/pt-BR.json`.

## CSV examples for Network and TIN

CHIVE does not currently bundle a network preset. TIN does have the bundled
Terrain Surface preset; the TIN CSV below is only a tiny manual example. Copy
either example into a file, save it with a `.csv` extension, and upload it
through the normal file picker when you want a minimal hand-made dataset.

### Network edge list

```text
source,target,weight,group
Alice,Bob,3,team-a
Alice,Carol,1,team-a
Bob,Dave,2,team-b
Carol,Dave,5,team-b
Dave,Erin,1,team-b
Erin,Alice,4,team-a
```

Map `source` and `target` to the source and target columns. Optionally map `weight` to the
weight column and `group` to the group column.

### TIN surface

```text
x,y,z
0,0,10
10,0,14
0,10,12
10,10,18
5,5,15
2,8,11
8,3,16
```

Map `x`, `y`, and `z` to the X, Y, and Z columns. All three must be numeric, and you need at
least three rows to triangulate a surface.

## Maintaining this reference

When you add or change a chart type, update this file: its required and optional columns,
its aggregation modes, and any new empty-state message. The data contracts here are derived
from `src/modules/visualizations/`, `src/modules/chartControls/`, and the `chive-chart-empty-*`
keys in `src/i18n/en.json`; keep those and this document in agreement. For the full per-chart
mechanics, update the matching [chart deep dive](../development/charts/README.md) in the same pass.
