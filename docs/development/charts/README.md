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
- **Render dispatch**: dispatch goes through
  [renderChartFromSpec.js](../../../src/modules/panelSubsystem/renderChartFromSpec.js),
  which routes each spec to the matching chart entry function under
  [src/modules/visualizations/](../../../src/modules/visualizations) or, for per-chart
  packages, the package's panel adapter under [src/charts/](../../../src/charts)
  (bar and scatter3d today).
- **Section adapters**: legacy charts keep one `*ChartSection.js` under
  [chartRenders/](../../../src/components/datasetWorkspace/chartRenders); per-chart packages
  bring their own `workspaceSection.js`. These map config to the renderer
  options bag and surface localized empty states via `showChartMessage` from
  [chartContainerLifecycle.js](../../../src/utils/chartContainerLifecycle.js).
- **Color utilities**: [colorUtils.js](../../../src/utils/colorUtils.js) (`interpolateColor`,
  `buildRankMap`, `buildSliceColor`, `isValidHexColor`).
- **SVG scaffold**: [scaffold.js](../../../src/charts/shared/svg/scaffold.js) owns the
  shared title, SVG/group setup, axes, and axis-label builders used by SVG charts.
- **Tooltips and click-to-filter**: [tooltip.js](../../../src/charts/shared/tooltip/tooltip.js).
  The categorical filter-action subsystem is documented in detail in the bar chart's
  [section 7.6](bar.md) and reused by pie, treemap, bubble, scatter, and network.
- **Live preview throttle**: the color-picker live path is documented in the TIN chart's
  [section 10](tin.md) and shared by every chart's color inputs.
- **Frozen panel snapshots**: see [Architecture reference](../architecture-reference.md).

## Maintaining These Deep Dives

Each doc is derived from its renderer, controls, config, and tests. When you change a chart's
behavior, update its deep dive alongside [Chart and data reference](../../user/chart-reference.md): the data
contracts, the option keys, the empty states, and any new algorithm or interaction.
