# The TIN Chart, end to end

This document explains how CHIVE's TIN (Triangulated Irregular Network) surface
chart works, from the config a dataset stores, through the sidebar controls, into
the renderer, and out to the panel/export paths. It is meant to be read top to
bottom the first time and used as a reference afterwards. File links are relative
to this document (which lives in `docs/development/charts/`).

Section 2 covers the mathematical and cartographic theory the chart rests on (what
a TIN *is*, independent of this codebase); everything from section 3 onward is how
CHIVE implements it.

## Scope and evidence

CHIVE's TIN chart is an SVG renderer for numeric `(x, y, z)` rows. It is not a
general GIS DEM system: it does not know coordinate reference systems, map
projections, geodesic distance, terrain units, survey uncertainty, or measurement
error. Unless a section explicitly says otherwise, "surface" means CHIVE's
piecewise-linear height-field model over the triangulated input points.

The CHIVE-specific behavior in this document is derived from these source files and
tests:

- Renderer: [tinChart.js](../../../src/modules/visualizations/tinChart.js)
- Sidebar controls: [tinControls.js](../../../src/modules/chartControls/tinControls.js)
- Config constants: [charts.js](../../../src/config/charts.js)
- Per-dataset config defaults: [chartDefaults.js](../../../src/config/chartDefaults.js)
- Bundled preset catalog: [presetCatalog.js](../../../src/data/presetCatalog.js)
- Renderer tests: [tinChart.test.js](../../../tests/modules/visualizations/tinChart.test.js)

Use "guarantee" narrowly when maintaining this file: a statement should be backed by
source/tests, by the mathematical model under stated assumptions, or by documented
measurements. Design intent and visual judgment should be phrased as such.

---

## 1. What a TIN chart is

A TIN chart turns a cloud of `(x, y, z)` points into a continuous-looking surface.
The x/y pair places a point on the plane; z is the "height" at that point. The
renderer connects the points into a mesh of triangles (a Delaunay triangulation),
then colors each triangle by its height so the whole thing reads as a heatmap-style
surface. On top of the colored surface it can draw the triangle edges, the original
points, contour lines (isolines), a single highlighted threshold contour, the
convex hull outline, and per-point z labels.

It is the most option-dense renderer in the app. All three axes (x, y, z) must be
numeric columns.

The name itself is the data structure: a **T**riangulated **I**rregular **N**etwork
is a mesh of triangles built over *irregularly* spaced sample points (as opposed to
a regular grid). In GIS and surveying, TINs are one common way to represent terrain
or other sampled scalar surfaces. CHIVE applies that representation to arbitrary
numeric data, but it does not add GIS metadata or terrain-domain validation.

Key files:

- Renderer: [tinChart.js](../../../src/modules/visualizations/tinChart.js)
- Sidebar controls: [tinControls.js](../../../src/modules/chartControls/tinControls.js)
- Config constants: [charts.js](../../../src/config/charts.js)
- Per-dataset config defaults: [chartDefaults.js](../../../src/config/chartDefaults.js)
- Color math: [colorUtils.js](../../../src/utils/colorUtils.js)
- Section adapter (main results view): [tinChartSection.js](../../../src/components/results/chartRenders/tinChartSection.js)
- Panel adapter (saved snapshots): [renderChartFromSpec.js](../../../src/modules/panelSubsystem/renderChartFromSpec.js)

---

## 2. Mathematical and cartographic foundations

This section is the "why" behind the renderer. It is deliberately
implementation-agnostic: it describes the geometry and the cartographic conventions
a TIN surface encodes. Each later implementation subsection points back here.

### 2.1 The surface model: a single-valued height field (2.5D)

A TIN represents a **height field**: a function `z = f(x, y)` that assigns exactly
one height to each point of the plane. This is often called a **2.5D** surface
rather than true 3D, because over any `(x, y)` there is a single z. That single
constraint has real consequences:

- It can model terrain, temperature over a map, a cost surface, a density field, or
  any scalar quantity sampled across two continuous dimensions.
- It **cannot** model overhangs, caves, vertical cliffs, or any geometry where one
  `(x, y)` has two heights. A coastline cliff in a TIN is a steep slope, never a
  true vertical face.

The input is a finite set of samples `{(xᵢ, yᵢ, zᵢ)}`. The job of the surface model
is to *interpolate* a continuous `f` from those scattered samples so a height is
defined everywhere inside the data's footprint, not only at the sample points.

### 2.2 TIN versus raster grid (the cartographic choice)

Digital elevation models (DEMs) come in two classic families:

- **Raster / grid DEM:** heights sampled on a regular lattice of cells. Simple to
  store and process, but it imposes a fixed resolution everywhere and forces
  irregular field data to be resampled onto the grid first.
- **TIN:** heights kept at their original irregular sample locations, connected into
  triangles. This is what CHIVE uses.

The TIN model is useful in surveying and GIS because:

- The model uses each sample `zᵢ` as a vertex height. In CHIVE's rendered fill, the
  displayed color is still mean-z sampled and 128-bucket quantized (sections 7.7 and
  8.2), so the color layer should not be described as exact at every source point.
- It **adapts to the data**: dense triangles where samples are dense (rugged or
  well-surveyed areas), large triangles where samples are sparse (flat or
  under-sampled areas). Detail follows the data instead of a fixed cell size.
- It consumes **irregularly distributed measurements natively** — survey points,
  LIDAR returns, bathymetric soundings, weather stations — which is precisely the
  shape of data a user drops into CHIVE.

The cost is more complex geometry (you must triangulate), which is the work the next
subsections describe.

### 2.3 Delaunay triangulation: the geometry

Given the sample points' `(x, y)` positions, many triangulations can be possible. The
**Delaunay triangulation** is a common default for scattered-point interpolation,
defined by the **empty-circumcircle property**: a triangle belongs to the
triangulation only if the circle through its three vertices contains no other sample
point in its interior.

Two facts make it a practical choice for CHIVE's surface model:

- **It maximizes the minimum angle** across all possible triangulations of the point
  set. In plain terms, it avoids long, thin "sliver" triangles as much as the points
  allow. Slivers are bad for interpolation: a tiny change in a far vertex swings the
  interpolated height wildly across a sliver, producing visual artifacts. Fat,
  well-shaped triangles give stable, well-conditioned interpolation.
- **It is the dual of the Voronoi diagram.** Two sample points are joined by a
  Delaunay edge exactly when their Voronoi cells (regions closer to that point than
  any other) share a boundary. So the triangulation connects each point to its
  natural spatial neighbors.

Properties worth knowing:

- The **outer boundary** of the Delaunay triangulation is the **convex hull** of the
  points. The chart's optional hull outline is literally this boundary.
- It is **unique** when no four points are cocircular; cocircular configurations
  (e.g. points on a perfect grid) are degenerate and any consistent tie-break is
  acceptable.
- CHIVE computes it with d3-delaunay (Delaunator under the hood, an O(n log n)
  sweep-hull algorithm). Actual render time still depends on browser, hardware, row
  count, point layout, overlay settings, and SVG export work.

### 2.4 Linear interpolation over a triangle (barycentric)

Once the plane is partitioned into triangles, the surface inside each triangle is
the **unique linear (planar) interpolant** through its three vertex heights. That is
the defining simplification of a TIN: the surface is flat within each triangle and
bends only at the edges.

The clean way to express the interpolant is **barycentric coordinates**. Any point
`p` inside a triangle with vertices `v₁, v₂, v₃` can be written

```
p = λ₁·v₁ + λ₂·v₂ + λ₃·v₃,   with   λ₁ + λ₂ + λ₃ = 1,   λᵢ ≥ 0
```

and the interpolated height is the same weighted combination of the vertex heights:

```
z(p) = λ₁·z₁ + λ₂·z₂ + λ₃·z₃
```

This interpolant is **C⁰ continuous** (heights match across shared edges) but not
**C¹** (the slope can change abruptly at an edge). That discontinuity in slope is
the mathematical source of the characteristic **faceted** look of a raw TIN.

CHIVE does not evaluate this interpolant per pixel. It approximates the colored
surface by flat-shading small sub-triangles, each painted by its **mean vertex
height** `(z₁ + z₂ + z₃)/3`. There is a precise justification for the mean: the
centroid of a triangle has barycentric coordinates `(1/3, 1/3, 1/3)`, so for the
linear interpolant the mean of the vertex heights equals the model height at the
triangle's centroid. Coloring a sub-triangle by its mean-z therefore samples CHIVE's
piecewise-linear model at that sub-triangle's center.

### 2.5 Midpoint subdivision: refining how the surface is sampled

A single flat color per base triangle (the chart's **flat** fill mode) looks
faceted. To make the fill look like a smooth gradient, each base triangle is
recursively split and each small piece colored by its own mean height.

The split is **1-to-4 midpoint subdivision**: connect the midpoints of the three
edges, producing four sub-triangles. Each is congruent to the others, similar to the
parent at half the linear scale, and one quarter of its area. After `d` levels a base
triangle becomes **4ᵈ** leaf sub-triangles.

The important mathematical point: the base patch is **planar** (it is the linear
interpolant of section 2.4). Midpoint subdivision samples *that same plane* more
finely; it never bends the geometry. Because the patch is linear, an edge midpoint's
true height is simply the average of the two endpoint heights, so the subdivided mesh
lies exactly on the original planar facet. Subdivision changes only **how finely
color is sampled across the facet**, not the surface itself.

This is why depth controls smoothness:

- The color error of a sub-triangle (its mean-z versus the continuously varying true
  height across it) is proportional to the height range spanned by that sub-triangle,
  which **halves with each subdivision level** (∝ 2⁻ᵈ).
- As `d` increases, the piecewise-constant coloring converges uniformly to the
  continuous linear color field. Depth 0 = one flat color (faceted); higher depth =
  a near-continuous gradient inside each triangle.

### 2.6 Contour lines: level sets and marching triangles

A **contour line** (isoline; in topography, an isohypse) is the set of points at a
fixed height `L`: the **level set** `{ (x, y) : f(x, y) = L }`. On a real map these
are the curving brown lines of equal elevation; their spacing is the **contour
interval**, and closely spaced contours mean steep ground, widely spaced means
gentle.

On a piecewise-linear TIN this has an exact construction within each non-degenerate
triangle. The surface inside one triangle is a plane, so the intersection of that
plane with the horizontal plane `z = L` is a **straight line segment**. CHIVE emits
independent per-triangle contour segments; it does not stitch adjacent segments into
continuous polylines or smooth them. This is the simplicial form of **marching
squares**, usually called **marching triangles**:

- For a triangle, look at each of its three edges. An edge between vertices of height
  `z₁` and `z₂` is crossed by level `L` exactly when `(z₁ − L)` and `(z₂ − L)` have
  **opposite signs** (one vertex below the level, one above).
- The crossing point sits at parameter `t = (z₁ − L) / (z₁ − z₂)` along the edge —
  ordinary linear interpolation of where the height equals `L`.
- A triangle that is crossed at all is crossed on exactly **two** edges (generic
  case), yielding one segment. The degenerate case where `L` passes exactly through a
  vertex collapses to a point and is discarded.

Choosing the levels is a cartographic decision with two conventions:

- **By count:** pick N "nice" round levels spanning the data range (the convention
  for labeled contour intervals on thematic maps).
- **By step:** a fixed interval between contours, like a topographic map's stated
  contour interval (e.g. every 10 m).

### 2.7 Coloring by elevation: hypsometric tinting and classification

Filling a surface by height is, in cartographic terms, **hypsometric tinting** (also
called layer tinting): elevation bands shown as colors. The classic convention runs
greens for lowlands through yellows and browns for hills to white for peaks, with
blues for water and bathymetry. CHIVE's built-in **terrain** ramp is a hand-picked
gradient meant to evoke that convention (deep water → shore → grass → foothills →
mountain → snow); the other ramps (viridis, plasma, etc.) are D3 scientific color
gradients used for the same z-to-color mapping.

The choice between the two **distribution** modes is the classic thematic-map
**classification** question — how to map a continuous quantity onto color bands:

- **value** = **equal-interval** classification. Color is linear in the actual
  height: `t = (z − z_min) / (z_max − z_min)`. It preserves the true vertical
  proportions, but a single tall outlier compresses everything else into a narrow
  slice of the ramp.
- **rank** = empirical-rank classification. CHIVE sorts the input vertex z values,
  then maps any queried z value (including interpolated leaf mean-z values that were
  not original rows) by binary search into that sorted distribution. This can reveal
  structure in skewed or clustered data at the cost of distorting the true vertical
  scale. Ties share a rank.

### 2.8 The threshold contour as an index/feature line

A TIN often needs one special, emphasized contour rather than a whole family. The
chart's **threshold** is exactly that: a single level set at a user-chosen height,
drawn boldly. Mathematically it is one isoline level (section 2.6); cartographically
it stands in for a meaningful boundary — a **coastline** at sea level, a **flood
line**, a **snow line**, a **treeline**, or an **index contour** highlighted for
reference.

---

## 3. The big picture (data flow)

There are two ways a TIN chart gets drawn: the **live results view** (the main
chart area, driven by the active dataset's config) and the **panel** (saved chart
snapshots assembled into a dashboard). Both end at the same renderer,
`renderTinChart`.

```
                 ┌─────────────────────────────────────────────┐
                 │  Active dataset.chartConfig.tin (live state) │
                 └─────────────────────────────────────────────┘
                        │                          │
       sidebar edits    │                          │  render
   (tinControls.js) ────┘                          ▼
        write config                  chartsView.renderCharts()
                                      → renderTinChartSection()      [results view]
                                        → renderTinChart(container, rows, x,y,z, opts)
                                              │
   "Add to panel"                            │
   (eventHandlers → panelManager)            │
   structuredClone of config + rows          │
        │                                     │
        ▼                                     │
   chartSnapshot { config, dataSnapshot, … }  │
        │                                     │
   renderCanvasPanel() → mountSlot()          │
   → renderChartFromSpec.renderTin()          │
     → renderTinChart(container, spec.dataSnapshot, …, spec.config)
                                              ▼
                                   ┌──────────────────────┐
                                   │   <svg> in container  │
                                   └──────────────────────┘
```

The renderer is **stateless and pure-ish**: every call wipes the container
(`container.replaceChildren()`) and rebuilds the whole SVG from scratch. There is
no diffing, no retained scene graph, no per-instance handle. Re-rendering is the
only update mechanism. This keeps the code simple and keeps the SVG output clean
enough to export directly, at the cost of doing all the work every time, which is
the central tension the performance design (section 9) addresses.

---

## 4. The data model

### 4.1 Where config lives

Each dataset owns a `chartConfig` object, and `chartConfig.tin` is the TIN chart's
slice of it. The canonical fresh shape is built by `createDefaultChartConfig()` in
[chartDefaults.js](../../../src/config/chartDefaults.js) (the `tin:` block). A saved or
partial config is deep-merged onto these defaults by
`mergeChartConfigWithDefaults()` in the same file (user-set fields win, missing
fields fall back to default).

### 4.2 The `chartConfig.tin` keys

| Key | Meaning | Default |
|---|---|---|
| `enabled` | Whether the chart is shown at all | `false` |
| `expanded` | Sidebar group expanded state | `false` |
| `x`, `y`, `z` | Numeric column names bound to the axes | `null` |
| `customTitle` | Optional title above the chart (≤80 chars) | `''` |
| `chartHeight` | SVG height in px (clamped 220–900) | `460` |
| `fillMode` | `'smooth'` (subdivided) or `'flat'` (one color per base triangle) | `'smooth'` |
| `subdivisionDepth` | Smooth-mode subdivision level, 0–4 | `3` |
| `colorRamp` | One of `TIN_COLOR_RAMPS` (see 8.1), or `'custom'` | `'custom'` |
| `gradientMinColor` / `gradientMaxColor` | Endpoints of the custom two-color ramp | `#5d8aa8` / `#ffffff` |
| `gradientDistribution` | `'value'` (linear in z) or `'rank'` (quantile) | `'value'` |
| `colorScheme` | Named palette last applied via the preset buttons | `'Colorblind-Safe'` |
| `showEdges` / `edgeColor` | Draw triangle edges | `true` / `#5f5a53` |
| `showPoints` / `pointRadius` | Draw the source points | `true` / `3` |
| `showZLabels` | Draw the z value next to each point | `false` |
| `showHull` / `hullColor` | Draw the convex hull outline | `false` / `#3f3a33` |
| `showIsolines` | Draw contour lines | `false` |
| `isolineMode` | `'count'` (N evenly spaced) or `'step'` (every S units) | `'count'` |
| `isolineCount` | Number of contours in count mode, 2–20 | `5` |
| `isolineStep` | Spacing in step mode (>0) | `1` |
| `isolineColor` / `isolineWidth` | Contour stroke (when not colored by z) | `#1f2937` / `0.8` |
| `colorIsolinesByZ` | Color each contour by its level instead of a flat color | `false` |
| `isolineMinColor` / `isolineMaxColor` | Endpoints when coloring contours by z | `#1e40af` / `#dc2626` |
| `showIsolineLabels` / `isolineLabelSize` / `isolineLabelColor` | Numeric labels on contours | `false` / `10` / `#1f2937` |
| `showThreshold` / `thresholdValue` / `thresholdColor` / `thresholdWidth` | A single highlighted contour at a chosen z | `false` / `0` / `#dc2626` / `2` |
| `showXAxisLabel` / `showYAxisLabel` | Axis title text | `true` / `true` |

### 4.3 The constants behind the defaults

[charts.js](../../../src/config/charts.js) holds the bounds and shared values:

- `CHART_COLORS.tin` = `#5d8aa8` (the default min-gradient/base color).
- `CHART_DIMENSIONS.tin` = `{ width: 700, height: 460, margins: { top:16, right:16, bottom:44, left:56 } }`.
- `CHART_HEIGHT_LIMITS.tin` = `{ min: 220, max: 900 }` (the height-drag handle clamps to this, and the renderer clamps to the same range so the drag box and SVG agree).
- `TIN_COLOR_RAMPS` (frozen): `custom, viridis, plasma, magma, inferno, turbo, terrain, grays`.
- `TIN_CHART` object: all the depth/isoline/threshold bounds, plus the two
  rendering caps added for performance: `rampBuckets: 128` and
  `maxSurfaceLeaves: 262144` (see section 9).

---

## 5. The control sidebar

[tinControls.js](../../../src/modules/chartControls/tinControls.js) builds the
right-sidebar control group and wires every input to a config write. It exposes
three functions, registered in the chart-controls manager registry
([chartControlsManager.js](../../../src/modules/chartControls/chartControlsManager.js),
the `tin:` entry):

- `createTinControls(dataset, numericOptions, allColumns)` builds the DOM.
- `setupTinControlListeners(dataset, numericOptions, allColumns, onConfigChanged)` wires events.
- `computeDefaults(dataset, ctx)` picks the first three distinct numeric columns for x/y/z when the chart is first enabled.

### 5.1 The four sections

`createTinControls` groups controls (via `groupControls`) into:

1. **Data** (expanded): the x, y, z column selects. Options are the numeric columns
   plus a "none" entry. The selects are numeric-only by design.
2. **Display** (expanded): custom title text, x/y axis-label toggles.
3. **Surface** (collapsed): fill mode, subdivision-depth slider, color-ramp select,
   custom gradient min/max color inputs, gradient distribution select, and the
   color-preset palette buttons.
4. **Overlays** (collapsed): edges + edge color, points + point radius, z labels,
   hull + hull color, then the full isoline block (toggle, mode, count, step,
   color, width, color-by-z + its min/max colors, labels + size + color), then the
   threshold block (toggle, value, color, width).

### 5.2 Enable/disable cascade

Controls disable themselves based on dependent state so the UI never offers a knob
that does nothing. The pattern is a boolean passed as the `disabled` argument:

- Everything is disabled when `!config.enabled`.
- The subdivision slider is also disabled when `fillMode === 'flat'` (flat mode has
  no subdivision).
- The custom gradient min/max inputs and the preset palette are disabled unless
  `colorRamp === 'custom'` (named ramps ignore the two-color gradient).
- The whole isoline sub-tree is disabled unless `showIsolines`; within it,
  `isolineCount` is disabled in step mode and `isolineStep` in count mode; the flat
  `isolineColor` is disabled when `colorIsolinesByZ` is on (and the min/max colors
  are disabled when it is off); label size/color are disabled unless
  `showIsolineLabels`.
- The threshold value/color/width are disabled unless `showThreshold`.

### 5.3 Listener wiring and value clamping

`setupTinControlListeners` uses the shared helpers in
[controlListenerHelpers.js](../../../src/modules/chartControls/controlListenerHelpers.js):

- **Selects** (`setupSelectListeners`): x/y/z transform to `null` if the chosen
  value is no longer a numeric column; `gradientDistribution`, `fillMode`,
  `isolineMode`, and `colorRamp` transform to their allowed enums.
- **Checkboxes** (`setupCheckboxListeners`): store the boolean `checked` state.
- **Sliders** (`setupSliderListener`): update the inline `<output>` on every
  `input` (live tick display) but only write config on `change` (release).
- **Number inputs** (`setupNumberInputListener`): write the parsed float on
  `change`, falling back to the supplied default for garbage.
- **Color inputs** (`setupColorInputListener`): the live-preview path, see section 10.
- **Color presets** (`setupColorPresetListeners`): each palette button writes
  `gradientMinColor` from palette index 0 and `gradientMaxColor` from index −1
  (last), plus the palette name into `colorScheme`.

Every write goes through `makeUpdater`, which merges the partial into
`chartConfig.tin` and fires `onConfigChanged`. The renderer never reads the DOM
controls; it only reads config that the listeners have written.

---

## 6. The render entry chain

### 6.1 Results view

[chartsView.js](../../../src/components/results/chartsView.js) decides which chart blocks
to show. It calls `renderTinChartSection({ config: chartConfig.tin, rows })`
([tinChartSection.js](../../../src/components/results/chartRenders/tinChartSection.js)).
That adapter:

1. Resolves the block (`chart-block-tin`) and container (`chart-tin-container`)
   elements (IDs in [elementIds.js](../../../src/config/elementIds.js), as
   `CHART_BLOCKS.tin` / `CHART_CONTAINERS.tin`).
2. Hides the block and clears the container if the chart is disabled.
3. Sets the container `min-height` to the configured `chartHeight`.
4. Maps every `config.*` key into the renderer's `options` bag (including
   localized axis labels via `t(...)` and the current locale via `getLocale()`).
5. Calls `renderTinChart(container, rows, config.x, config.y, config.z, options)`.
6. On failure, shows a localized empty-state message (`insufficient-points` gets a
   specific message; anything else a generic one).

### 6.2 Panel view

When a chart is added to the panel, `addChartToPanel`
([panelManager.js](../../../src/modules/panelManager.js)) captures a snapshot:
`config`, `dataSnapshot`, and `columnsSnapshot` are each `structuredClone`d at
capture time, so the snapshot is **frozen** and decoupled from later edits to the
active dataset. `renderChartFromSpec.renderTin()`
([renderChartFromSpec.js](../../../src/modules/panelSubsystem/renderChartFromSpec.js))
maps `spec.config` to the same options bag and calls the identical
`renderTinChart` against `spec.dataSnapshot`. This frozen-snapshot property is what
lets the live preview skip re-rendering the panel (section 9.4 / 10).

---

## 7. Inside `renderTinChart`

`renderTinChart(container, rows, xColumn, yColumn, zColumn, options = {})` is the
heart of the system. It returns a `Result`: `ok({ triangles, polygons })` on
success or `fail(reason)` when it cannot draw. Here is the full pipeline in order.
The mathematical justification for each step lives in section 2; this section is the
mechanics.

### 7.1 Guard and option parsing

- Returns `fail()` immediately if the container or any of the three column names is
  missing.
- Reads and clamps every option into a local with a safe fallback: `fillMode`
  collapses anything but `'flat'` to `'smooth'`; colors run through
  `normalizeColor` (valid `#RRGGBB` or fallback); numeric options are range-clamped;
  `chartHeight` is clamped to 220–900; isoline count/width/label size and threshold
  width are clamped to their `TIN_CHART` bounds. `customTitle` is trimmed and capped
  at 80 chars.

### 7.2 Point extraction

Rows are filtered to those with non-missing x/y/z, mapped to
`{ x, y, z, raw, index }` numbers, and filtered again to finite values. If fewer
than 3 valid points remain it returns `fail('insufficient-points')` (you cannot
triangulate fewer than 3 points — see section 2.3). The original row is kept as
`raw` for tooltips.

### 7.3 Container reset and layout

- `container.replaceChildren()` wipes any previous render; `hideChartTooltip()`
  clears a stray tooltip.
- Width comes from `container.clientWidth` (floored at 320, default 700); height is
  the clamped `chartHeight`.
- Inner dimensions subtract the margins, an optional title offset (20px when a title
  is present), and room for the legend (`legendGap` 22, `legendHeight` 14).
- An `<svg>` is appended; the title text (if any) is drawn; a `<g>` group is
  translated by the margins (+ title offset) so all subsequent drawing happens in
  the inner coordinate space.

### 7.4 Scales

`xScale` / `yScale` are linear D3 scales over the data extents (with a ±1 pad when
an axis is degenerate), `.nice()`d, mapped to the inner width/height. The y range is
inverted (`[innerHeight, 0]`) so larger y is higher on screen (the north-up map
convention).

### 7.5 Color ramp resolution (`sampleRamp`)

`sampleRamp(t)` maps a normalized `t ∈ [0,1]` to a color string:

- If `colorRamp` is a named scientific ramp, it uses the matching D3 interpolator
  from `D3_RAMP_BY_NAME` (`viridis, plasma, magma, inferno, turbo, grays`) or the
  synthesized `terrain` ramp (an `interpolateRgbBasis` through deep-water → shore →
  grass → foothills → mountain → snow, intended to evoke the hypsometric convention
  of section 2.7).
- Otherwise (`custom`) it linearly interpolates between `gradientMinColor` and
  `gradientMaxColor` via `interpolateColor` from
  [colorUtils.js](../../../src/utils/colorUtils.js).

`sampleRamp` is used by the surface fill, the legend strip, and (indirectly) every
bucket color. The legend samples the continuous ramp, while the surface fill uses
bucket-center colors after quantization.

### 7.6 z → ramp position (`tForZ`) and distribution modes

`tForZ(z)` converts a z value to its `[0,1]` ramp position. This is the
classification step of section 2.7, in code. Two modes:

- **value** (equal-interval): `t = (z − zMin) / (zMax − zMin)`. Linear in the actual
  value, so outliers stretch the rest of the data into a narrow band of the ramp.
- **rank** (quantile): a binary search over the sorted z values returns the quantile
  position `rank / (n−1)` against the input vertex z values. Interpolated leaf
  mean-z values are then queried against that same sorted distribution, so this mode
  is rank-like rather than a strict equal-count binning of rendered leaf colors. Ties
  share the same rank.

> Note: `tForZ` deliberately reimplements rank with a binary search rather than
> reusing `buildRankMap` from colorUtils. `buildRankMap` is item-keyed and gives
> ties distinct ranks; the TIN surface needs a value→t function (it is queried with
> interpolated leaf mean-z values that are not original data points) with shared tie
> ranks.

### 7.7 Color quantization (`bucketAt`)

This is the core of the performance design. Instead of computing a unique color per
triangle, the renderer quantizes `tForZ(z)` into one of `bucketCount`
(= `TIN_CHART.rampBuckets` = 128) buckets:

```js
const bucketCount = TIN_CHART.rampBuckets;
const bucketAt = z => Math.min(
    bucketCount - 1,
    Math.floor(Math.max(0, Math.min(1, tForZ(z))) * bucketCount),
);
```

Every triangle whose mean-z lands in the same bucket gets the **same** color (the
bucket's center color), which lets them all be merged into one SVG element. See
section 8 for the visual tradeoff and section 9 for why this matters.

### 7.8 Screen-space triangulation

The points are projected to screen coordinates (`sx`, `sy`) **before**
triangulating: `Delaunay.from(screenPoints, d => d.sx, d => d.sy)` (the Delaunay
construction of section 2.3, via d3-delaunay). Triangulating in screen space (rather
than raw data space) makes the mesh depend on the rendered coordinate system. That
means non-uniform x/y scaling, chart aspect ratio, and the inverted screen y-axis can
affect Delaunay adjacency. This is the behavior the renderer implements; it is not a
claim that raw-coordinate triangulation would be equivalent.

### 7.9 Effective depth (`resolveSurfaceDepth`)

Before subdividing, the renderer resolves the actual depth to use. This is an
exported pure helper so it can be unit-tested without a DOM:

```js
resolveSurfaceDepth({ requestedDepth, fillMode, zMin, zMax, triangleCount })
```

Policy, in order:

1. **Flat mode or constant-z → 0.** In flat mode there is no subdivision; for a
   constant-z surface every leaf would share one bucket anyway, so subdivision adds
   nothing (and would otherwise pile every leaf into one giant path).
2. Otherwise clamp the requested depth to `[minSubdivisionDepth, maxSubdivisionDepth]`
   (0–4) via `clampDepth`.
3. **Leaf budget:** while `triangleCount * 4 ** depth > TIN_CHART.maxSurfaceLeaves`,
   decrement depth (floored at 0). This caps total geometry work on very large
   renders. Uploads are already bounded elsewhere by `FILE_SIZE_LIMIT_BYTES` (15 MB)
   and `ROW_LIMIT` (200000 rows), but a large allowed dataset can still be expensive
   to triangulate, subdivide, overlay, and export. The fallback is a coarser surface
   fill, not input rejection.

### 7.10 Subdivision and bucketed path emission (`emitSubdivided`)

For each base Delaunay triangle, `emitSubdivided` recursively splits it into
`4 ** depth` leaf sub-triangles by edge midpoints (the 1-to-4 midpoint subdivision of
section 2.5; recall this only refines color sampling of a planar facet, it does not
change the geometry). At a leaf, it computes the mean-z of the three vertices (the
model height at the leaf centroid, section 2.4) and appends a path fragment
**directly into the bucket's fragment list**:

```js
const fragment = `M${fmtCoord(a.x)},${fmtCoord(a.y)}L…L…Z`;
bucketFragments[bucketAt(meanZ)].push(fragment);
```

`bucketFragments` is a fixed-size array of 128 string arrays. There is no
intermediate object per leaf — fragments go straight into their bucket. `fmtCoord`
rounds each coordinate to 2 decimals (`String(Math.round(n*100)/100)`), which keeps
the path payload small (screen pixels don't need 17-digit float precision).

After the loop, the renderer emits **one `<path>` per non-empty bucket**, iterating
buckets in index order (inherently deterministic, no sorting needed):

```js
const constantZ = zMin === zMax;
for (let bucket = 0; bucket < bucketCount; bucket++) {
    const fragments = bucketFragments[bucket];
    if (fragments.length === 0) continue;
    trianglesGroup.append('path')
        .attr('d', fragments.join(''))
        .attr('fill', sampleRamp(constantZ ? 0 : (bucket + 0.5) / bucketCount))
        .attr('stroke', 'none');
}
```

So a render that would have produced ~63,000 `<polygon>` elements (≈500 points at
depth 3) now produces **at most 128 `<path>` elements**. Constant-z surfaces are
special-cased to paint at `sampleRamp(0)` (the ramp's low color), matching the
tested low-color behavior after bucketing. The triangles group keeps its
`.tin-triangles` class.

### 7.11 Convex hull

If `showHull`, `delaunay.hullPolygon()` is drawn as a single closed `<path>` with no
fill and a 1.5px `hullColor` stroke. As noted in section 2.3, this hull is the outer
boundary of the triangulation itself.

### 7.12 Isolines (contour lines)

This is the marching-triangles algorithm of section 2.6, in code. If `showIsolines`
and z is not constant, the renderer builds a list of z **levels**:

- **count mode:** `scaleLinear().domain([zMin,zMax]).nice().ticks(isolineCount)`
  (the "nice round levels" convention).
- **step mode:** every `isolineStep` units from `ceil(zMin/step)*step` upward (a fixed
  contour interval), capped at `TIN_CHART.maxIsolineLevels` (200) so a tiny step can't
  generate thousands of contours.

For each level, `computeIsolineSegments(triangleVerts, level)` walks every base
triangle and finds where the level crosses its edges. It is the direct implementation
of section 2.6: for each edge it tests the sign change `d1 = v1.z − level`,
`d2 = v2.z − level`, and when they differ it places the crossing at
`t = d1 / (d1 − d2)`. The two crossings of a triangle become one segment; degenerate
(zero-length) crossings are skipped. The function also tracks the longest segment per
level, used to anchor an optional label (with its rotation angle normalized to stay
readable). Segments are emitted independently per triangle; CHIVE does not join them
into continuous contour polylines.

Per segment, two lines are drawn:

- a **visible** line with the contour color and width (`pointer-events: none`), and
- a fattened **transparent hit line** (`.tin-isoline-hit`, min 6px,
  `pointer-events: stroke`, carrying `data-z`) so hovering anywhere near a thin
  contour shows a tooltip with the level value.

Color: flat `isolineColor`, or — when `colorIsolinesByZ` — interpolated between
`isolineMinColor` and `isolineMaxColor` by the level's position in the z range.
Labels (when `showIsolineLabels`) are drawn at the longest segment's midpoint,
rotated along the contour, with a light stroke halo for legibility.

A shared `attachIsolineHoverHandlers` wires `pointerover/move/out` on the group to
show/move/hide the tooltip when the target is a `.tin-isoline-hit` line.

### 7.13 Threshold contour

If `showThreshold` and `thresholdValue` is within `[zMin, zMax]`, the same
`computeIsolineSegments` machinery draws a single emphasized contour at that value
(the index/feature contour of section 2.8): its own `.tin-threshold-contour` group,
with matching visible + hit lines and the same hover tooltip.

### 7.14 Edges

If `showEdges`, `collectUniqueEdges(delaunay)` dedupes the triangle edges (each
shared edge once) and draws a thin (0.6px, 0.5 opacity) line per edge in
`edgeColor`. This exposes the underlying triangulation mesh on top of the colored
surface.

### 7.15 Points and tooltips

If `showPoints`, a `<circle>` per source point is drawn (`pointRadius`, dark fill,
light stroke). Each circle wires `mouseenter/mousemove/mouseleave` to show a tooltip
with the formatted x, y, z values (using the original `raw` row and the locale). These
are the actual samples the surface interpolates between.

### 7.16 z labels

If `showZLabels`, each point gets a small text label of its z value offset slightly
up-right of the point.

### 7.17 Axes and legend

- Bottom and left axes are drawn with `axisBottom`/`axisLeft` (6 ticks each).
- Axis title text is drawn when `showXAxisLabel` / `showYAxisLabel`.
- The **legend** is a horizontal gradient strip below the chart: 12 `<rect>` stops,
  each filled by `sampleRamp(i/12)`, with the `zMin` and `zMax` values labeled at
  the ends. The legend samples the continuous ramp, so it represents the configured
  ramp rather than the exact set of bucket colors used by the surface fill.

### 7.18 Return value

`ok({ triangles, polygons })` where `triangles` is the base Delaunay triangle count
and `polygons` is the analytic leaf count (`triangleCount * 4 ** effectiveDepth`).
`polygons` is computed, not counted (every base triangle yields exactly
`4 ** depth` leaves, section 2.5). The field name `polygons` is kept for API/test
stability even though leaves are no longer individual polygon elements.

---

## 8. The color system

### 8.1 Ramps

Eight ramp choices (`TIN_COLOR_RAMPS`): `custom` plus seven named ramps. Six named
ramps come straight from D3's sequential interpolators (`viridis, plasma, magma,
inferno, turbo, grays`); `terrain` is synthesized in-house via `interpolateRgbBasis`
through a hand-picked elevation gradient (the hypsometric tint of section 2.7).
`custom` is a simple two-color linear gradient between the user's min and max colors.

### 8.2 Quantization tradeoff

The fill is quantized into 128 buckets (section 7.7). The color a triangle gets is
its bucket's **center** color: `sampleRamp((bucket + 0.5) / 128)`. This means a
triangle's fill can deviate from its "exact" ramp color by at most half a bucket —
1/256 of the ramp domain before color-space interpolation effects. This is a
deliberate fidelity/performance tradeoff. Banding is most likely to be visible on
smooth, low-noise gradients (for example, a black→white custom ramp on a gently
varying surface). Raising `rampBuckets` is the implementation knob if future tested
datasets need finer color resolution.

Flat fill mode is quantized the same way (it gains element-merging too: ~990
triangles → ≤128 paths). Constant-z surfaces paint at the ramp's low color; this
behavior is covered by renderer tests.

### 8.3 Color math reference

[colorUtils.js](../../../src/utils/colorUtils.js): `interpolateColor(min, max, t)` (clamped
linear RGB lerp, used by the custom ramp and color-by-z contours), `hexToRgb` /
`rgbToHex` / `toHex`, `isValidHexColor` / `normalizeHexColor` (validation/fallback
used by the controls and `normalizeColor` inside the renderer).

---

## 9. Performance design

### 9.1 The original problem

The renderer is stateless: every render re-triangulates, re-subdivides, and rebuilds
every SVG node. The killer was node count. At the default depth 3, ~500 points →
~990 base triangles → ~63,000 leaf triangles, each previously its own `<polygon>`
with a unique fill string. At max depth 4 it was ~253,000 elements. Creating tens of
thousands of SVG nodes made color-picker dragging visibly stutter on heavy TIN
renders. This section describes the design problem and fix; it does not claim a
current benchmark unless one is added with browser, hardware, dataset, and options.

The cost is dominated by per-element DOM overhead (allocation, style resolution,
hit-testing, display-list bookkeeping, GC churn), not pixel rasterization. So the fix
is to slash element count.

### 9.2 The bucketed-path fix

Quantize the ramp into 128 buckets, group leaves by bucket, and emit one `<path>`
per bucket (all of a bucket's triangles as subpaths in one `d` string). DOM drops
from ~63,000 polygons to ≤128 paths — roughly 500×. Because the fills were already
flat per-leaf approximations of a planar facet (not a true gradient, section 2.5),
quantization is expected to be a small visual tradeoff compared with the DOM savings.

Supporting choices:

- **Bucket during subdivision**, not after. `emitSubdivided` pushes path fragments
  straight into per-bucket arrays, avoiding ~63k/253k short-lived leaf objects per
  render (GC churn during a drag).
- **Fixed-size bucket array** indexed `0..127`, iterated in order — deterministic
  output, no Map overhead, no sorting.
- **2dp coordinates** (`fmtCoord`) keep each `d` string compact.
- **Leaf budget** (`maxSurfaceLeaves`, section 7.9) bounds total work for huge
  datasets.

### 9.3 What it does and doesn't fix

This fixes the **fill** node count, which dominated. The Delaunay triangulation and
subdivision CPU still run each render (the smaller half of the cost). It is a
color-picker/render performance fix, **not** a full client-side DoS guard. CHIVE has
upload-level caps (`FILE_SIZE_LIMIT_BYTES = 15 MB`, `ROW_LIMIT = 200000`), but within
those caps Delaunay construction, points/edges/z-label overlays, isoline segment
counts, and panel-export payload size can still be large. Broader input-size policy is
cross-cutting across chart types and is outside this renderer-specific change.

### 9.4 The live-preview panel skip

Separately, `livePreviewRender` in [main.js](../../../src/main.js) used to also call
`renderCanvasPanel()` on every tick, re-rendering all panel blocks even when hidden —
doubling the work if a TIN chart was in the panel. That call was removed: panel
blocks paint from frozen `structuredClone` snapshots (section 6.2), so a live config
edit can never change them. The picker's commit (`change`) event re-renders the panel
through the normal `CONFIG_UPDATED → refreshView` path anyway (still from the frozen
snapshot — a saved panel chart's appearance never tracks later config edits).

---

## 10. Live preview and the color picker

The live preview is what makes a color drag feel responsive without rebuilding the
whole sidebar (which would steal focus from the open picker).

Two events are wired on each color input (`setupColorInputListener` in
[controlListenerHelpers.js](../../../src/modules/chartControls/controlListenerHelpers.js)):

- **`input`** (fires continuously while the picker is open): writes the new color
  through `normalizeActiveDatasetConfig` — a **non-emitting** facade that updates
  state without firing `CONFIG_UPDATED` (which would trigger `refreshView` and
  rebuild the controls sidebar). Then it calls `triggerLiveRender()`.
- **`change`** (fires when the picker closes): writes through the normal emitting
  updater so `CONFIG_UPDATED` fires, auto-save marks the project dirty, and the
  sidebar refreshes.

`triggerLiveRender` ([livePreview.js](../../../src/modules/chartControls/livePreview.js))
invokes a registered callback. `main.js` registers
`throttle(livePreviewRender, 120)` (leading + trailing, so the first and final
values always paint). `livePreviewRender` re-renders only the chart visualizations
(`renderCharts`), not the controls and not the panel. The chart-height drag handle
shares this same path, so it benefits from the same optimization.

The intended outcome is that typical TIN renders complete quickly enough for the
120ms live-preview throttle to stay responsive. If this document later records a
specific timing claim, include the browser/version, hardware, dataset row count,
render options, date, and measurement method.

---

## 11. SVG export

The renderer emits pure SVG (no `<canvas>`, no embedded raster), which is what makes
direct SVG export possible. The bucketed-path change keeps this property and makes
exports dramatically smaller (≤128 paths instead of tens of thousands of polygons),
and the 2dp coordinate formatting shrinks them further. A future `<canvas>` surface
layer under an SVG overlay would be a possible direction for datasets that remain too
large for SVG, but that is not implemented here.

---

## 12. Invariants and edge cases

### Known limitations and non-claims

- **No CRS/projection semantics:** x and y are numeric chart coordinates only. CHIVE
  does not know coordinate reference systems, map projections, geodesic distance, or
  whether units are meters, degrees, pixels, or something else.
- **No uncertainty model:** the chart does not estimate measurement error, sampling
  uncertainty, interpolation confidence, or confidence bands.
- **No extrapolation outside the hull:** the TIN surface exists only over the convex
  hull of valid points. The renderer draws that hull when `showHull` is enabled, but
  it does not fill or predict outside it.
- **No stitched/smoothed contours:** isolines and threshold contours are independent
  per-triangle line segments, not topologically stitched contour paths.
- **Degenerate point layouts are not fully characterized:** fewer than three valid
  points are tested. Duplicate x/y positions, collinear points, and other Delaunay
  degeneracies should be documented only when source behavior is explicitly tested.
- **Large allowed datasets can still be expensive:** upload caps limit input size,
  but heavy overlays, isolines, Delaunay construction, and SVG export can still stress
  the browser.

- **< 3 valid points** → `fail('insufficient-points')`, section adapter shows a
  specific empty state (a triangle is the minimum triangulable set, section 2.3).
- **Constant z** (`zMin === zMax`): depth forced to 0, a single path, filled at the
  ramp's low color; isolines are skipped (no levels to draw).
- **Degenerate axis** (single x or y value): scale domain padded by ±1.
- **Invalid colors**: every color option falls back through `normalizeColor` /
  `normalizeHexColor` to a sane default.
- **Out-of-range threshold**: a `thresholdValue` outside `[zMin, zMax]` draws nothing.
- **Tiny isoline step**: capped at 200 levels.
- **Stateless renders**: the container is fully wiped each call; no retained state,
  so any caller can re-render at any time safely.
- **Panel snapshots are frozen**: a saved panel chart does not track later edits to
  the active dataset's config — by design.

---

## 13. Tests

[tinChart.test.js](../../../tests/modules/visualizations/tinChart.test.js) covers the
renderer. Notable cases after the bucketed-path change:

- Subpath count (`M` count across `.tin-triangles path`) equals
  `triangles * 4 ** depth` at depths 0 and 2; no stray `<polygon>` elements; path
  count ≤ `rampBuckets`; `result.polygons` matches the analytic count.
- Flat mode: one subpath per base triangle.
- Merge guard: a denser dataset with a black→white ramp yields distinct per-bucket
  fills and far fewer paths than leaves.
- Rank vs value distribution produce different fill sets on skewed z.
- Constant-z: one path, low color, depth forced to 0.
- Leaf budget clamps depth on a large grid.
- Coordinate precision: no `d` attribute carries 3+ decimals.
- `resolveSurfaceDepth` unit tests (clamping, flat, constant-z, budget step-down,
  base-triangulation-over-budget floor) — pure, no DOM.

Plus the existing isoline/threshold/hit-line/tooltip/legend coverage, untouched by
the change.
[panelManager.edges.test.js](../../../tests/modules/panelSubsystem/panelManager.edges.test.js)
has a snapshot-isolation regression test guarding that a panel snapshot's config is
captured by value (so the live-preview panel skip is safe).

---

## 14. Quick reference

**Element IDs** ([elementIds.js](../../../src/config/elementIds.js)): container
`chart-tin-container`, block `chart-block-tin`. Control IDs are `viz-…-tin-…`
(e.g. `viz-select-tin-x`, `viz-slider-tin-subdivision`,
`viz-input-tin-gradient-min`).

**DOM structure** of a rendered TIN chart:

```
<svg>
  <text>                         (optional title)
  <g transform=margins>
    <g class="tin-triangles">    (≤128 <path>, one per color bucket)
    <path>                       (optional hull)
    <g class="tin-isolines">     (visible + .tin-isoline-hit line pairs, optional labels)
    <g class="tin-threshold-contour">  (optional)
    <g class="tin-edges">        (optional)
    <g class="tin-points">       (optional circles, hover tooltips)
    <g class="tin-z-labels">     (optional)
    <g> bottom axis  <g> left axis
    <text> axis titles
  <g class="tin-legend">         (12-stop gradient strip + min/max labels)
```

**Tuning knobs** ([charts.js](../../../src/config/charts.js) `TIN_CHART`):
`rampBuckets` (color resolution vs path count), `maxSurfaceLeaves` (geometry budget),
`maxSubdivisionDepth`, `maxIsolineLevels`.

**Theory → implementation map:**

| Concept (section 2) | Implementation |
|---|---|
| Height field / 2.5D (2.1) | point extraction, z column (7.2) |
| TIN vs grid (2.2) | the whole renderer's model |
| Delaunay triangulation (2.3) | `Delaunay.from` (7.8), hull (7.11) |
| Barycentric / mean-z (2.4) | leaf mean-z coloring (7.10) |
| Midpoint subdivision (2.5) | `emitSubdivided`, `resolveSurfaceDepth` (7.9–7.10) |
| Level sets / marching triangles (2.6) | `computeIsolineSegments` (7.12) |
| Hypsometric tint, classification (2.7) | `sampleRamp` / `tForZ` (7.5–7.6), ramps (8.1) |
| Index/feature contour (2.8) | threshold contour (7.13) |
