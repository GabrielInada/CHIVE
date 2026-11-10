# Chart deep dives

This directory holds one in-depth, code-plus-theory walkthrough per CHIVE chart type. Each
doc explains the chart from the config a dataset stores, through the sidebar controls, into the
renderer, and out to the panel and export paths, and pairs the implementation with the
mathematical or algorithmic theory it rests on.

| Field | Value |
|---|---|
| Audience | Contributors changing chart renderers, controls, panel rendering, or tests. |
| Source of truth | Implementation-level chart data flow, algorithms, config, edge cases, and test coverage. |
| Update when | A chart renderer, control surface, presentation flow, algorithm, empty-state path, or test contract changes. |

These are the companion to the higher-level docs one directory up:

- [Chart and data reference](../../user/chart-reference.md) is the simplified matrix: which columns and
  settings each chart needs, how aggregation works, and the exact empty-state messages. Start
  there to pick a chart; come here to understand how it works.
- [Architecture reference](../architecture-reference.md) documents the shared state, panel,
  and event architecture these renderers plug into.

## The charts

| Chart | Deep dive | What it does | Foundations focus |
|---|---|---|---|
| Bar | [bar.md](bar.md) | Compares a measure across categories | Aggregation, band/linear scales, color encodings |
| Scatter | [scatter.md](scatter.md) | Relationships between two columns | Axis types, linear/log scales, OLS regression + CI band |
| Pie / Donut | [pie.md](pie.md) | Part-to-whole composition | Arc geometry, value-to-angle, Top-N rollup |
| Bubble | [bubble.md](bubble.md) | Group size and nested hierarchy | Circle packing, multi-level hierarchy, drill-down |
| Network | [network.md](network.md) | Relationships between entities | Force-directed simulation, nodes from edges |
| Treemap | [treemap.md](treemap.md) | Part-to-whole as nested area | Squarified tiling, area encoding |
| Line | [line.md](line.md) | Trends over an ordered dimension | Time scales, curve interpolation, missing-value modes |
| TIN | [tin.md](tin.md) | Continuous surface from scattered points | Delaunay triangulation, interpolation, contours |
| 3D scatter | [scatter3d.md](scatter3d.md) | Three numeric variables as a rotatable point cloud | WebGL rendering, D3-to-Three scale contract, per-chart package layout, GPU lifecycle |

## Chart symbol grammar

The package directory and persisted chart key use the canonical lowercase chart
key. Exported symbols use a PascalCase chart stem followed by a role suffix such
as `Controls`, `ControlListeners`, `Into`, `Options`, or `Interactions`. New symbols should use one plain stem consistently
within their package.

The current plain stems are `Bar`, `Pie`, `Treemap`, `Bubble`, `Line`, `Tin`,
`Scatter`, `Network`, and `Scatter3d`. Some existing scatter renderer and control
exports use the longer legacy `ScatterPlot` stem, while the corresponding
network exports use `NetworkGraph`. Those established exports remain accepted
to avoid aesthetic-only churn, but new exports should prefer the plain
canonical-key stem rather than extending the legacy forms.

## Chart definitions

Each chart owns its static identity, behavior constants, dimensions, workspace
IDs, catalog category, and fresh default-config factory in
`src/config/charts/definitions/<type>.js`. A definition's `allowedValues` maps an
enumerated config key to the values the chart offers; chart config
canonicalization replaces any other value with the chart's default, so readers
use those keys as stored. The lists cover measures, sort and curve choices,
missing-data and aggregation modes, palettes, color and gradient modes, bubble
labels and nesting, pie Top-N and label placement, scatter scales and encodings,
and TIN surface and isoline modes. An object instead of a list describes a nested
block, currently scatter's `regression.mode`. Numeric ranges and column bindings
keep their existing checks. Pie's unused `colorMode`, scatter's derived
`colorFieldType`, and TIN's renderer-only `colorRenderingMode` are not listed.
`tests/charts/enumeratedSettings.test.js` checks that the controls offer exactly
the values their definitions accept, including conditional selects and palettes.
The composition module
`src/config/charts/definitions.js` supplies canonical display order and derives
the shared keyed maps without registering renderers or controls. Follow the
[new-chart checklist in the source map](../source-map.md#where-do-i-put-new-code)
when adding a type.

The three implementation registries intentionally stay separate from these
definitions and from one another. Controls need control descriptions and
activation defaults; the dataset workspace dispatches section
renderers; and the panel resolves snapshot renderers. Keeping one registry per
surface prevents each integration path from importing unrelated
implementations and keeps capability differences local to their surface
instead of pretending all charts expose one universal contract. Definition
and registry completeness tests keep the supported type lists aligned without
coupling their module graphs.

## How each doc is organized

Every doc follows the same skeleton (scaled to the chart's complexity), so once you have read
one you can navigate any of them:

1. What the chart is
2. **Foundations** (the math/algorithm/domain theory behind it)
3. The big picture (data flow)
4. The data model (`chartConfig.<type>` keys and the `*_CHART` constants)
5. The control sidebar
6. The render entry chain (dataset workspace + panel)
7. Inside the renderer (the step-by-step internals)
8. The color / scale system
9. Performance notes
10. Live preview and interaction
11. Export behavior
12. Invariants and edge cases
13. Tests
14. Quick reference (element IDs, DOM structure, tuning knobs)

## Shared infrastructure

The renderers share a small set of building blocks, documented once and referenced from each
doc rather than repeated:

- **Result envelope**: `ok()` / `fail(reason)` from [result.js](../../../src/utils/result.js).
- **Render dispatch**: panel snapshots enter through
  [renderChartSnapshot.js](../../../src/features/panel/slots/renderChartSnapshot.js),
  which validates the request and resolves its implementation through the
  [panel registry](../../../src/charts/registries/panel.js). The registry builds the
  chart input from the snapshot (its rows, config and column types) and hands it to the
  chart's package-owned `presentation.js` under [src/charts/](../../../src/charts).
- **Chart input and sections**: both surfaces hand each chart the same chart input
  (`rows`, `config`, `columnTypeByName`, `filterCallbacks`; see `ChartInput` in
  [types.js](../../../src/types.js)). In Visualizations the
  [workspace registry](../../../src/charts/registries/workspace.js) owns the section
  routine for every chart: block visibility, and a minimum height equal to the height
  the chart is drawn at ([chartHeight.js](../../../src/charts/shared/chartHeight.js)). Each package's
  `presentation.js` passes stored config unchanged, supplies localized labels and
  runtime context, and renders localized empty states via
  `showChartMessage` from
  [containerLifecycle.js](../../../src/charts/shared/containerLifecycle.js).
  Workspace charts, saved Panel previews, and layout slots therefore show the
  same failure message, including after resize or reopening an existing project.
  Add to panel also accepts charts displaying an empty state; captures keep their
  frozen rows and config, and the presentation flow returns the renderer result.
- **Renderer inputs**: every chart renderer takes `(container, rows, config, context)`.
  Column bindings and visual settings stay in stored `config`; each package's
  `options.js` normalizes its numeric bounds, colors and defaults once. Enumerated
  settings have already been canonicalized against the chart definition. `context`
  carries presentation-owned labels, locale, column types, callbacks and transient
  render approval or application settings. Normalizers do not translate or supply
  English label defaults. Real-render presentation tests exercise the stored settings
  and translated output; renderer equivalence tests retain the existing SVG snapshots.
- **Color utilities**: [colorUtils.js](../../../src/utils/colorUtils.js) (`interpolateColor`,
  `buildRankMap`, `isValidHexColor`); pie's `buildSliceColor` lives in its package
  ([color.js](../../../src/charts/pie/color.js)).
- **SVG scaffold**: [scaffold.js](../../../src/charts/shared/svg/scaffold.js) owns the
  shared title, SVG/group setup, axes, and axis-label builders used by SVG charts.
- **Tooltips and click-to-filter**: [tooltip.js](../../../src/charts/shared/tooltip/tooltip.js)
  owns the tooltip overlay, pin identity and dismissal, and
  [filterActions.js](../../../src/charts/shared/tooltip/filterActions.js)
  (`togglePinnedFilterTooltip`) toggles a tooltip with the global-filter actions for the column and
  category token a chart names. The categorical filter-action subsystem is documented in
  detail in the bar chart's [section 7.6](bar.md) and reused by pie, treemap, bubble, scatter,
  and network. Presentations use [labels.js](../../../src/charts/shared/tooltip/labels.js)
  with their translator to supply `labels.close`, `labels.missing`, and
  `labels.filterActions`. Renderers pass `closeLabel` and `filterActionLabels` separately
  from filter callbacks. Action buttons, state badges, network headings, and the close
  button therefore use the current interface language wherever the chart is drawn. Renderers
  pass the clicked SVG mark as `target`; its DOM identity distinguishes categories, bubble
  hierarchy nodes and scatter points across chart instances and Panel slots. Hover show/move
  and `hideHoverTooltip` leave a pin intact; explicit `hideChartTooltip` clears it on background
  clicks or render cleanup. Network supplies an anchor closure over the clicked node datum.
  The shared [pinning tests](../../../tests/charts/shared/tooltip/pinning.test.js) cover toggle,
  replacement, dismissal and anchor cleanup; [chart wiring tests](../../../tests/charts/shared/tooltip/chartPinning.test.js)
  exercise the real renderers in separate Panel slots.
- **Control factories and grouping**: [factories.js](../../../src/charts/shared/controls/factories.js)
  builds the labeled sidebar widgets (selects, sliders, number and color inputs, palette presets), the
  options of a Top-N select (`topNSelectOptions`), and finds the palette preset a chart's
  colors still match (`findAppliedColorPreset`), the one its palette buttons mark; [grouping.js](../../../src/charts/shared/controls/grouping.js)
  wraps them in collapsible sections. Neither writes config.
- **Described controls**: a chart can declare each control once, as data: its config key,
  widget, label, options, and when it is shown or disabled (the `ControlDescription` typedef
  in [types.js](../../../src/types.js)). [describedControls.js](../../../src/charts/shared/controls/describedControls.js)
  builds the controls with the factories and wires each one to the `ChartConfigWriter` as it
  creates it, so no listener looks a control up by id. The widget decides how it writes: a
  color input previews on `input` and commits on `change`, every other widget commits on
  `change`. An enumerated setting's select lists exactly the values its definition's
  `allowedValues` accept, so its description gives only the labels: message keys, or
  `optionText` for labels that are not messages (TIN's ramp names). A control no widget
  covers is a `custom` description whose `build` creates and wires its elements (pie's radius
  sliders, palette, and slice grid; bubble's nesting levels). Descriptions that charts share
  live beside the builder:
  [categoryControls.js](../../../src/charts/shared/controls/categoryControls.js) for the
  category charts' measure, value-column, and Top-N selects,
  [axisControls.js](../../../src/charts/shared/controls/axisControls.js) for the numeric axis
  selects of the 3D scatter and TIN, and
  [zoomControls.js](../../../src/charts/shared/controls/zoomControls.js) for the Reset Zoom
  button of pie and network. A key `block.setting` names a setting inside a block of the
  config, such as scatter's `regression.mode`. Every chart declares its controls this way, in
  its package's `controls/descriptions.js`.
- **Drawn categories**: bar, pie, treemap, and bubble take the categories they draw from
  `aggregateCategories` in
  [categoryAggregation.js](../../../src/charts/shared/categoryAggregation.js). It groups and
  measures the rows, leaves out values at or below 0 for pie, treemap, and bubble
  (`positiveOnly`), orders them by bar's sort, and keeps the first `topN`. It also returns
  `omittedValueTotal`, the sum the cut leaves out, which pie folds into its Other sector, and
  `retainedValueTotal`, the sum of the kept values that tooltip shares are taken of.
- **Measure label**: bar, pie, treemap, and bubble name their measure through
  [measure.js](../../../src/charts/shared/measure.js), which returns i18n keys. Each
  presentation flow translates the short form (`measureLabelKey`: "Count", "Sum", "Mean")
  once and passes it to its renderer as `labels.measure`, for tooltips, bar's y axis, and
  bubble titles; bar's sort select names its value orders with it ("Sum (high → low)"). The
  measure select and Panel capture subtitles use the long form
  (`measureOptionLabelKey`: "Count rows", "Sum numeric column", "Average numeric column").
  Any measure other than sum or mean is named as count.
- **Measure and value column**: bar, pie, treemap, and bubble keep their value column by one
  rule, `valueColumnForMeasure` in [measure.js](../../../src/charts/shared/measure.js), both
  when the user switches the measure (the measure description's `toPatch`) and when the
  chart is activated
  (`categoryChartDefaults` in
  [activationDefaults.js](../../../src/charts/shared/controls/activationDefaults.js), the
  `computeDefaults` the four share). Count keeps the stored column; sum and mean keep it
  while it is a visible numeric column and otherwise take the first one. The value-column
  select is disabled when the measure reads no value column (`measureUsesValueColumn`), and
  stores only a visible numeric column (its `toValue`). Their measure select lists the
  definition's `allowedValues.measureMode`, and their Top-N select the chart's `topNOptions`;
  [categoryControls.js](../../../src/charts/shared/controls/categoryControls.js) describes
  all three selects for the four charts.
  [dataControls.test.js](../../../tests/charts/registries/dataControls.test.js) checks these
  rules for the four charts through the controls registry.
- **Live preview throttle**: the color-picker live path is documented in the TIN chart's
  [section 10](tin.md) and shared by every chart's color inputs.
- **Detached panel captures**: see [Architecture reference](../architecture-reference.md).

## Maintaining These Deep Dives

Each doc is derived from its renderer, controls, config, and tests. When you change a chart's
behavior, update its deep dive alongside [Chart and data reference](../../user/chart-reference.md): the data
contracts, the option keys, the empty states, and any new algorithm or interaction.
