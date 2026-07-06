# The Pie / Donut Chart, end to end

This document explains how CHIVE's pie/donut chart works, from the config a dataset stores,
through the sidebar controls, into the renderer, and out to the panel/export paths. It is
meant to be read top to bottom the first time and used as a reference afterwards. File
links are relative to this document (which lives in `docs/development/charts/`).

Section 2 covers the geometry and encoding ideas the chart rests on (angle as a share of a
whole), independent of this codebase; everything from section 3 onward is how CHIVE
implements it.

For the high-level "which columns does it need" summary, see the pie row in
[Chart and data reference](../../user/chart-reference.md). For the shared state/panel/event architecture,
see [Architecture reference](../architecture-reference.md).

Key files:

- Renderer: [pieChart.js](../../../src/modules/visualizations/pieChart.js)
- Sidebar controls: [pieControls.js](../../../src/modules/chartControls/pieControls.js)
- Config constants: [charts.js](../../../src/config/charts.js) (`PIE_CHART`)
- Per-dataset config defaults: [chartDefaults.js](../../../src/config/chartDefaults.js) (the `pie` block)
- Section adapter (dataset workspace): [pieChartSection.js](../../../src/components/datasetWorkspace/chartRenders/pieChartSection.js)
- Panel adapter (saved snapshots): [renderChartFromSpec.js](../../../src/modules/panelSubsystem/renderChartFromSpec.js)
- Color math: [colorUtils.js](../../../src/utils/colorUtils.js) (`buildSliceColor`)

---

## 1. What a pie / donut chart is

A pie chart shows part-to-whole composition: each category becomes a wedge whose angle is
proportional to that category's share of the total. A donut is the same chart with a hole in
the middle (a non-zero inner radius). Like the bar chart it is an **aggregating** chart
(count or sum per category), but it encodes magnitude as **angle** rather than length, which
is good for "what fraction of the whole" but weaker than bars for precise comparison between
similar slices.

CHIVE's version adds Top-N trimming (with an "Other" rollup), inside or outside labels with
leader lines, a legend, zoom/pan, per-slice color overrides, and the shared click-to-filter
tooltips.

---

## 2. Foundations: angle as a share of the whole

### 2.1 The aggregation behind the wedges

The category column partitions the rows; each group is reduced to a single number by the
**measure mode**: `count` (rows per category) or `sum` (total of a numeric value column).
Missing/empty categories collapse to one `N/A` group. This is the same count/sum vocabulary
the bar chart uses (see the bar doc's [section 2.2](bar.md)); the pie just omits
`mean`, because a mean has no meaningful "share of total."

### 2.2 From value to angle

For positive sector values, each slice's angle is its value's fraction of the positive grand
total, swept around the full circle:

```
sliceAngle = (value / total) · 2π
```

So the wedges sum to a full turn when the rendered values are positive, which is exactly why a
pie reads as "parts of one whole." Sum mode should be used with non-negative measures; the
renderer does not currently filter negative category totals before handing values to D3. The
`pie()` layout generator turns the sorted values into start/end angles, and the `arc()`
generator turns each angle pair plus an inner and outer radius into an SVG path.

### 2.3 Donut, pad angle, and radius

- **Inner radius = 0** gives a classic pie; **inner radius > 0** gives a donut. The hole
  trades the (hard-to-read) center area for a cleaner look and room for a central label.
- **Pad angle** inserts a small gap between adjacent wedges, which helps separate many thin
  slices visually.
- The outer radius is clamped to what fits the container, and the inner radius is kept at
  least 8px below the outer so a donut never collapses to a ring of zero width.

### 2.4 Top-N and the "Other" rollup

Pies degrade badly with many categories (dozens of slivers). Top-N keeps only the largest N
categories, in one of two modes:

- **truncate**: simply drop everything past rank N (the remainder is not shown, so the
  visible wedges no longer sum to the true whole).
- **other**: keep the top N and roll the remainder into a single **"Other"** wedge, so the
  circle still represents 100% of the data. This is the more honest default for
  part-to-whole.

### 2.5 Labeling small slices

A label on a sliver is unreadable, so the renderer only labels slices above a minimum angular
share (about 4% for inside labels, 3% for outside labels with leader lines). Outside labels
get a polyline connector from the wedge to the text so they do not overlap the arc.

---

## 3. The big picture (data flow)

Two draw paths, both ending at `renderPieChart`.

```
                 ┌─────────────────────────────────────────────┐
                 │  Active dataset.chartConfig.pie (live state) │
                 └─────────────────────────────────────────────┘
                        │                          │
       sidebar edits    │                          │  render
   (pieControls.js) ────┘                          ▼
        write config                  chartsView.renderCharts()
                                      → renderPieChartSection()        [dataset workspace]
                                        → renderPieChart(container, rows, category, opts)
                                              │
   "Add to panel" → structuredClone snapshot │
        │                                     │
   renderChartFromSpec.renderPie()            │
     → renderPieChart(container, spec.dataSnapshot, spec.config.category, …)
                                              ▼
                                   ┌──────────────────────┐
                                   │   <svg> in container  │
                                   └──────────────────────┘
```

The renderer is **stateless**: each call wipes the container and rebuilds the SVG. Rows are
already global-filtered; the renderer aggregates on top of them. Panel snapshots are frozen
`structuredClone`s (see [Architecture reference](../architecture-reference.md)).

---

## 4. The data model

### 4.1 Where config lives

`chartConfig.pie` is the pie slice of each dataset's `chartConfig`, built fresh by
`createDefaultChartConfig()` and merged by `mergeChartConfigWithDefaults()` in
[chartDefaults.js](../../../src/config/chartDefaults.js).

### 4.2 The `chartConfig.pie` keys

| Key | Meaning | Default |
|---|---|---|
| `enabled` / `expanded` | Shown at all / sidebar expanded | `false` / `false` |
| `category` | Categorical column bound to the wedges | `null` |
| `measureMode` | `'count'` or `'sum'` | `'count'` |
| `valueColumn` | Numeric column summed in sum mode | `null` |
| `innerRadius` / `outerRadius` | Donut hole / wedge radius in px | `0` / `100` |
| `padAngle` | Gap between wedges, in degrees | `0` |
| `zoomScale` | Current zoom multiplier | `1` |
| `topN` | Keep N largest categories (0 = all) | `0` |
| `topNMode` | `'other'` (rollup) or `'truncate'` | `'other'` |
| `color` | Base color slices are derived from | `CHART_COLORS.pie` (`#5f7c33`) |
| `customSliceColors` | Per-category color overrides (`{ token: hex }`) | `{}` |
| `colorScheme` | Named palette last applied | `'Colorblind-Safe'` |
| `showCategoryLabel` / `showValueLabel` / `showLegend` | Label and legend toggles | `true` |
| `labelPosition` | `'inside'` or `'outside'` | `'inside'` |
| `customTitle` / `chartHeight` | Title / SVG height (220 to 720) | `''` / `360` |

### 4.3 The constants behind the defaults

[charts.js](../../../src/config/charts.js): `CHART_COLORS.pie` = `#5f7c33`;
`CHART_DIMENSIONS.pie` = 700x360 with 16px margins; `CHART_HEIGHT_LIMITS.pie` =
`{ min: 220, max: 720 }`; `PIE_CHART` holds the radius bounds (`minOuterRadius: 20`,
`maxOuterRadius: 140`), pad-angle bounds (0 to 12 degrees), zoom bounds (0.3 to 4),
`otherSliceColor: '#9c9690'`, and the measure/top-N option lists.

---

## 5. The control sidebar

[pieControls.js](../../../src/modules/chartControls/pieControls.js) builds three sections via the
standard `createPieChartControls` / `setupPieChartControlListeners` / `computeDefaults`
exports.

### 5.1 The three sections

1. **Data & aggregation** (expanded): category select, measure (count/sum), value-column
   select, Top-N select, Top-N mode (other/truncate).
2. **Display** (expanded): inner/outer radius sliders, pad-angle slider, zoom slider,
   category/value label toggles, legend toggle, title, label-position select, and a Reset
   Zoom button.
3. **Styling** (collapsed): the base color input, and (only when the chart has sectors to
   color) the palette-preset buttons and the **per-slice color picker grid**.

### 5.2 Enable/disable and conditional rendering

- Everything is disabled when `!config.enabled`.
- The value-column select is disabled in `count` mode.
- The palette presets and per-slice grid render only when the category column yields at least
  one sector (`getPieSectorValues` returns the category order, descending by aggregate with a
  stable tiebreaker, the same order the rendered pie uses).

### 5.3 Listener wiring and cross-constraints

Beyond the shared select/checkbox/text/color helpers, the pie has several custom listeners:

- **Measure**: switching to sum auto-picks the first numeric value column if none is set.
- **Inner/outer radius**: cross-constrained so the inner radius is always kept at least 8px
  below the outer (adjusting one can clamp the other).
- **Reset Zoom**: resets both the zoom slider DOM and `zoomScale` to the default.
- **Palette presets**: map an N-color palette across the N sectors by writing
  `customSliceColors` for each (not a single gradient).
- **Per-slice color grid**: each swatch writes through the non-emitting facade on `input`
  (live drag preview, no sidebar rebuild) and commits through the emitting facade on `change`,
  the same live-preview discipline the TIN color picker uses (TIN doc [section 10](tin.md)).

---

## 6. The render entry chain

### 6.1 Dataset workspace

`renderPieChartSection({ config, rows, filterCallbacks })`
([pieChartSection.js](../../../src/components/datasetWorkspace/chartRenders/pieChartSection.js)) resolves
the block/container, hides+clears when disabled, sets the min-height, maps config into the
options bag (with localized labels including the `Other` label), and calls `renderPieChart`.
On failure it shows `chive-chart-empty-pie-sum` for `sum-no-numeric`, else
`chive-chart-empty-pie`.

### 6.2 Panel view

`renderChartFromSpec.renderPie()` maps `spec.config` into the same options and renders against
`spec.dataSnapshot` with empty `filterCallbacks` (no click-to-filter in panels).

---

## 7. Inside `renderPieChart`

`renderPieChart(container, rows, categoryColumn, options = {})` returns a `Result`.

### 7.1 Guard, options, aggregation

Returns `fail()` if container or category is missing. Options are clamped (colors validated,
radii/pad-angle/zoom clamped to `PIE_CHART` bounds, height to 220 to 720, title to 80 chars).
A `Map` aggregates count or sum per category (sum skips rows whose value is non-finite, and
needs `valueColumn`). It does not filter zero or negative sums; D3's pie layout allocates
proportional angle only to positive values. Entries are sorted descending by value with a
`compareStrings` tiebreaker. No entries → `fail('sum-no-numeric')` in sum mode, else `fail()`.

### 7.2 Top-N

When `topN > 0` and there are more categories than N: in `truncate` mode the list is cut to
N; in `other` mode the top N are kept and the rest are summed into a single
`{ category: Other, isOther: true }` entry.

### 7.3 Geometry

The center and a fitted `maxRadius` are computed from the container size and margins. The
`pie()` generator (with `sort(null)` so the pre-sorted order is preserved, and the configured
`padAngle`) produces start/end angles; `arc()` with the clamped inner/outer radii draws the
wedge paths. A separate `labelArc` at 62% of the ring radius positions inside labels.

### 7.4 Wedges, color, and interaction

One `<path>` per slice. Fill precedence: the `Other` slice uses `PIE_CHART.otherSliceColor`;
a category with a `customSliceColors` override uses that; otherwise `buildSliceColor` darkens
the base color by 8% per index step so adjacent wedges are distinguishable. Each wedge has a
white stroke. Hover shows a category/value/percentage tooltip; click pins the shared
categorical filter-action tooltip (the bar doc's [section 7.6](bar.md)), except the
`Other` slice, which pins a plain tooltip with no filter actions (it is an aggregate, not a
real category).

### 7.5 Zoom, labels, and legend

A `d3.zoom` behavior on the SVG viewport supports scroll/drag zoom within the scale extent,
initialized to the saved `zoomScale`. Labels are drawn inside (at the label arc centroid) or
outside (with a leader polyline and edge-anchored text), skipping slices below the minimum
angular share. An optional legend lists the first 8 entries with color swatches. Returns
`ok()`.

---

## 8. The color system

- **Base + shade**: `buildSliceColor(base, index)` from
  [colorUtils.js](../../../src/utils/colorUtils.js) darkens the base color 8% per step (capped at
  8 steps), giving a monochrome family from one color.
- **Per-slice overrides**: `customSliceColors[categoryToken]` wins over the shade for that
  category, set via the color grid or a palette preset.
- **Palette presets**: distribute a qualitative palette across the sectors (writing
  per-slice overrides), unlike the bar/scatter presets which seed a two-color gradient.
- **Other**: always the fixed `otherSliceColor` gray.

---

## 9. Performance notes

The pie emits one `<path>` per visible slice plus labels and a small legend, and Top-N bounds
the slice count, so it is light regardless of dataset size; the only row-scaled work is the
single aggregation pass. Color and radius edits flow through the shared throttled live-preview
path (TIN doc [section 10](tin.md)).

---

## 10. Live preview and interaction

Base color, per-slice colors, radii, pad angle, zoom, and title use the shared live-preview
path (non-emitting facade on `input`, commit on `change`). The per-slice color grid has its
own handler that writes a single sector's override live and re-renders without rebuilding the
sidebar, so dragging one swatch does not disturb the others.

Zoom/pan and the click-to-filter pinned tooltips are the pie's interaction layer on top of
that.

---

## 11. SVG and export

Pure SVG: `<path>` wedges, `<polyline>` leaders, `<text>`/`<tspan>` labels, and a `<g>`
legend, all under a zoomable viewport `<g>`. The panel exporter clones the live `<svg>`;
there is no separate export path.

---

## 12. Invariants and edge cases

- **No category column** → `fail()`, the adapter shows `chive-chart-empty-pie` ("Select at
  least one visible categorical column to build the pie/donut chart.").
- **sum mode with no numeric value column** (or no parseable values) → `fail('sum-no-numeric')`,
  mapped to `chive-chart-empty-pie-sum` ("Select a visible numeric value column to render
  pie/donut in sum mode.").
- **Missing/empty categories** collapse into a single `N/A` wedge.
- **Top-N other** keeps the rendered positive-value circle at 100%; **truncate** does not.
- **Non-positive sum aggregates** are not filtered by CHIVE before the D3 pie layout; use
  non-negative value columns for meaningful part-to-whole pies.
- **Inner radius** is always kept below the outer radius so a donut never inverts.
- **Tiny slices** are left unlabeled rather than drawing illegible text.
- **Stateless renders** and **frozen panel snapshots** behave as for every chart (panel
  wedges carry no filter actions).

Empty-state strings live in [en.json](../../../src/i18n/en.json) (`chive-chart-empty-pie*`);
Portuguese equivalents in [pt-BR.json](../../../src/i18n/pt-BR.json).

---

## 13. Tests

- [pieAndAxisLabels.test.js](../../../tests/modules/visualizations/pieAndAxisLabels.test.js)
  covers the renderer (slices, labels, top-N behavior).
- [pieControls.test.js](../../../tests/modules/chartControls/pieControls.test.js) covers control
  building, the radius cross-constraint, and the per-slice color logic.
- [renderChartFromSpec.test.js](../../../tests/modules/panelSubsystem/renderChartFromSpec.test.js)
  covers the panel dispatch path.

---

## 14. Quick reference

**Element IDs** ([elementIds.js](../../../src/config/elementIds.js)): container
`chart-pie-container`, block `chart-block-pie`. Control IDs are `viz-…-pie-…`
(e.g. `viz-select-pie-category`, `viz-slider-pie-inner-radius`,
`viz-select-pie-topn-mode`, `viz-pie-color-grid`).

**DOM structure** of a rendered pie chart:

```
<svg>
  <g> viewport (zoom/pan target)
    <text>                  (optional title)
    <g transform=center>
      <path> × N            (one per wedge, white stroke)
      <text>/<tspan>        (inside labels) OR <polyline> + <text> (outside labels)
  <g> legend                (first 8 entries, optional)
```

**Tuning knobs** ([charts.js](../../../src/config/charts.js) `PIE_CHART`): radius bounds, pad-angle
bounds, zoom bounds, `otherSliceColor`, `defaultTopN`/`defaultTopNMode`.

**Foundations → implementation map:**

| Concept (section 2) | Implementation |
|---|---|
| Count/sum aggregation, N/A (2.1) | the `Map` build (7.1) |
| Value → angle (2.2) | `pie()` + `arc()` generators (7.3) |
| Donut / pad / radius (2.3) | inner/outer radius clamp, `padAngle` (7.1, 7.3) |
| Top-N + Other rollup (2.4) | the Top-N branch (7.2) |
| Small-slice labeling (2.5) | angular-share filter on labels (7.5) |
