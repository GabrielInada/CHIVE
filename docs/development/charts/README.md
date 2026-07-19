# Chart deep dives

This directory holds one in-depth, code-plus-theory walkthrough per CHIVE chart type. Each
doc explains the chart from the config a dataset stores, through the sidebar controls, into the
renderer, and out to the panel and export paths, and pairs the implementation with the
mathematical or algorithmic theory it rests on.

| Field | Value |
|---|---|
| Audience | Contributors changing chart renderers, controls, panel rendering, or tests. |
| Source of truth | Implementation-level chart data flow, algorithms, config, edge cases, and test coverage. |
| Update when | A chart renderer, control surface, panel adapter, algorithm, empty-state path, or test contract changes. |

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
as `Controls`, `ControlListeners`, `PanelChart`, `ChartSection`, `Into`,
`Options`, or `Interactions`. New symbols should use one plain stem consistently
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
`src/config/charts/definitions/<type>.js`. The composition module
`src/config/charts/definitions.js` supplies canonical display order and derives
the shared keyed maps without registering renderers or controls. Follow the
[new-chart checklist in the source map](../source-map.md#where-do-i-put-new-code)
when adding a type.

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
  [renderChartFromSpec.js](../../../src/features/panel/slots/renderChartFromSpec.js),
  which validates the request and resolves its implementation through the
  [panel registry](../../../src/charts/registries/panel.js). Every chart resolves
  to its package-owned `panelAdapter.js` under [src/charts/](../../../src/charts).
- **Section adapters**: every per-chart package owns a `workspaceSection.js`.
  These map config to the renderer options bag and surface localized empty
  states via `showChartMessage` from
  [containerLifecycle.js](../../../src/charts/shared/containerLifecycle.js).
- **Color utilities**: [colorUtils.js](../../../src/utils/colorUtils.js) (`interpolateColor`,
  `buildRankMap`, `isValidHexColor`); pie's `buildSliceColor` lives in its package
  ([color.js](../../../src/charts/pie/color.js)).
- **SVG scaffold**: [scaffold.js](../../../src/charts/shared/svg/scaffold.js) owns the
  shared title, SVG/group setup, axes, and axis-label builders used by SVG charts.
- **Tooltips and click-to-filter**: [tooltip.js](../../../src/charts/shared/tooltip/tooltip.js).
  The categorical filter-action subsystem is documented in detail in the bar chart's
  [section 7.6](bar.md) and reused by pie, treemap, bubble, scatter, and network.
- **Control factories and grouping**: [factories.js](../../../src/charts/shared/controls/factories.js)
  builds the labeled sidebar widgets (selects, sliders, color inputs, palette presets) and
  [grouping.js](../../../src/charts/shared/controls/grouping.js) wraps them in collapsible
  sections. Both are DOM-only; the config writes are wired by the listener helpers in
  [listenerBindings.js](../../../src/charts/shared/controls/listenerBindings.js).
- **Live preview throttle**: the color-picker live path is documented in the TIN chart's
  [section 10](tin.md) and shared by every chart's color inputs.
- **Frozen panel snapshots**: see [Architecture reference](../architecture-reference.md).

## Maintaining These Deep Dives

Each doc is derived from its renderer, controls, config, and tests. When you change a chart's
behavior, update its deep dive alongside [Chart and data reference](../../user/chart-reference.md): the data
contracts, the option keys, the empty states, and any new algorithm or interaction.
