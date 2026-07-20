# CHIVE Modern Web Platform Audit

| Field | Value |
|---|---|
| Status | Implemented; baseline findings retained as a historical audit |
| Audited | 2026-07-20 |
| Baseline | Working tree at `9fcc1ad` (branch `develop`, clean) |
| Scope | Static HTML, all 25 stylesheets, overlays and dialogs, focus and keyboard handling, forms, render scheduling, workers, storage, fonts, serving configuration, and WebGL lifecycle |
| Guidance | `modern-web-guidance` skill, catalog version `2026_05_16-c5e7870` |
| Browser support posture | **Baseline Widely available.** Only features Baseline for roughly 2.5+ years are recommended; Baseline Newly available features are recorded in the watch-list instead |
| Build posture | **No build step, treated as inviolable.** Every recommendation works when nginx serves raw `index.html` + `src/` + `vendor/` |

`CLAUDE.md` requires running the `modern-web-guidance` skill before HTML, CSS, or
client-side JavaScript UI work, on the rationale that browser APIs move faster
than model training data. That rule governs new work. This audit runs the
guidance backwards across the existing surface, asking two questions:

1. What does CHIVE do by hand that the platform now does natively?
2. Where has a hand-rolled substitute drifted into an actual defect?

The second question turned out to matter more than the first.

## Implementation Decision Addendum

Approved on 2026-07-20 with the following product decisions:

- The existing 15 MiB file-size and 200,000-row thresholds become overridable
  warnings. CHIVE must not silently truncate imported or joined data.
- A true streaming and columnar large-data architecture is deferred to
  `internalDocs/large-data-mode-proposal.md` for separate research.
- Scatter charts render a representative 5,000-point geometry by default while
  deriving domains and analysis from the full data. Network charts refuse
  geometry above 1,000 nodes or 2,000 links. Either chart can receive a
  session-only, per-container approval to attempt the full render.
- Tabs use manual activation. Arrow, Home, and End move focus; Enter or Space
  activates the focused tab.
- Durable-storage permission is requested only from an explicit Settings action.
- PWA/service-worker work, transferable ingest buffers, catalog watch-list
  features, dark mode, logical-property conversion, preview virtualization, font
  subsetting, and project-schema migration remain deferred.

Implementation retains raw-static delivery and adds no runtime dependencies or
polyfills.

## Implementation Outcome

The approved implementation was completed on 2026-07-20. The findings below
describe the audited `9fcc1ad` baseline and intentionally remain unchanged as
the evidence behind the work; they are not claims about the current tree.

Delivered changes include:

- restored persistent, accessible feedback regions and corrected the cascade
  layer composition;
- converted and selectively preloaded fonts, flattened stylesheet loading,
  lazy-loaded locale catalogs and Three.js, and kept raw-static delivery;
- moved render coalescing to animation frames, chunked large preview-table DOM
  construction, delegated high-cardinality chart events, and added WebGL
  context recovery;
- migrated all application modals to native `<dialog>`, added reusable native
  confirmation, inline join validation, numeric constraints, manual-activation
  tabs, unified Pointer Events, and standardized visibility on `hidden`;
- added quota reporting and an explicit durable-storage request in Settings;
- enforced the approved scatter and network geometry budgets with session-only
  full-render approval; and
- preserved complete over-limit imports after approval, moved joins into the
  cancellable data worker, and retained worker-computed normalization and
  statistics.

The separately deferred streaming and columnar architecture remains documented
in `internalDocs/large-data-mode-proposal.md`. All other deferrals are listed in
the decision addendum above.

---

## Executive Summary

**Two findings are defects, not modernization opportunities, and should be fixed
before anything else in this document is scheduled.**

**P0-1: the error channel is dead in production.** `src/ui/feedback.js` looks up
`#errors-container` and `#loading-state`. Neither ID exists in `index.html` or
`about.html`. They exist only in `tests/ui/feedback.test.js`, which builds them
itself. Every `showError()` call in the app, including the top-level error
boundary, silently degrades to a 2.2-second toast with no `role="alert"` and no
`aria-live`. `showLoading()` is an unconditional no-op. 37 call sites across 9
files are affected.

**P0-2: the cascade layer graph has a silent nesting collision.** `chrome.css`
re-declares `@layer foundation` inside an import that is already in
`layer(foundation)`, producing `foundation.foundation`. The consequence is that
`animations.css` and `collapsed.css` escape the inner layer and outrank the
files they were meant to sit beside. The visible symptom is a byte-identical
10-selector ID list duplicated across two files, resolved by duelling
`!important` declarations, which is precisely what cascade layers exist to
prevent.

Beyond those, the three highest-leverage opportunities are:

**Loading.** Production serves 176 unbundled ES modules with `Cache-Control:
no-cache`, gated behind `body { visibility: hidden }` until JavaScript runs. Of
the 2.72 MB of eagerly-loaded vendor JavaScript, 2.09 MB is Three.js, needed by
one of nine charts. There are zero `modulepreload` hints and exactly one dynamic
`import()` in the entire codebase. Separately, 1.15 MB of fonts ship as
uncompressed TrueType that nginx does not even gzip.

**Overlays.** Five hand-rolled modal dialogs plus a 251-line focus-trap engine
reimplement `<dialog>`, which has been Baseline Widely available since March
2022. The reimplementation carries a real bug the native element cannot have:
with two dialogs open, one `Escape` closes both.

**Accessibility.** The tab UI has no tab semantics and two disagreeing
implementations. `inert` is never set anywhere, so background content stays
reachable behind every modal. Four of five dialogs have no accessible name. No
stylesheet honors `prefers-reduced-motion`. All font sizes are `px`, which
defeats user text scaling.

None of this is the result of carelessness. Nearly every hand-rolled mechanism
in CHIVE is well-commented and carefully built; several are better engineered
than what they replace. The pattern is simply that the platform caught up and
nobody re-audited.

---

## Audit Baseline

### What was swept

`index.html` (438 lines), `about.html` (119 lines), all 25 stylesheets under
`src/styles/` (3,542 lines), every overlay/dialog/tooltip/toast implementation,
all form control factories, focus and keyboard handling, `app/renderCoordinator.js`,
both workers and their host services, the persistence backends, `src/services/downloads/`,
the Three.js renderer, `Dockerfile`, and `docker/default.conf`.

### Guides consulted

Umbrella: `html`, `css`, `css-layout`, `performance`, `accessibility`.
Targeted: `declarative-dialog-popover-control`, `animate-to-from-top-layer`,
`break-up-long-tasks`, `defer-rendering-heavy-content`.

### The two framing decisions

**The no-build constraint is inviolable.** `Dockerfile:17-19` copies raw source,
not `dist/`:

```dockerfile
COPY index.html about.html /usr/share/nginx/html/
COPY src/  /usr/share/nginx/html/src/
COPY vendor/ /usr/share/nginx/html/vendor/
```

There is no `vite.config.js` in the repository. `dist/` exists as a stale
reference build and is not what ships. Every performance finding in this document
is written against unbundled raw ESM, not against a bundle. Bundling, hashed
filenames, and build-only aliases are out of scope by decision, not by oversight.

**Baseline Widely available.** Every recommendation below states the Baseline
date of the feature it relies on. Features that are Baseline Newly available
(including the Popover API, `@starting-style`, and `content-visibility`) are
deliberately deferred to the watch-list with the date they are expected to
qualify. This is the most important editorial rule in the document: under a
different posture roughly a third of the recommendations would change.

### Cross-references

The following are already documented elsewhere and are **not** re-reported here:

- `about.html` is not a Vite build input while `dist/index.html` still links to
  it. See `internalDocs/code-organization-audit.md:353-368`.
- `about.css` loads via a bare `<link>` outside the layer system
  (`about.html:14`). Intentional, documented at `src/styles/about.css:3` and
  `docs/development/styles.md:124`.

---

## Existing Strengths To Preserve

Several parts of CHIVE are already at or above the standard the guidance
describes. Recording them matters, because some of the recommendations below
touch adjacent code and these properties must survive.

### WebGL lifecycle is exemplary

`src/charts/scatter3d/renderers/three.js` is the best-engineered file reviewed.
It uses render-on-demand with no persistent `requestAnimationFrame` loop
(`:159`, `:184`), clamps pixel ratio against a configured maximum (`:95-96`),
and disposes GPU resources through an undo-list pattern (`:81-92`) where every
resource registers its disposer immediately after creation. The dispose hook is
stashed on the container (`:186`) and run by `clearChartContainer` before any
re-mount, so re-renders never stack a second WebGL context. It is also the only
chart with an explicit render budget (`maxPoints = 50000`, enforced with
extrema-preserving stride sampling in `data.js:108-123`).

### The persist worker avoids O(rows) cloning

`src/services/persistence/backends/workerBackend.js:135-183` strips `rows`,
`dataSnapshot`, and `columnsSnapshot` out of the message envelope,
`structuredClone`s only metadata, and re-sends payload arrays only when the array
*reference* changed since the last send. The worker refills omitted payloads from
its own caches with a staged commit that swaps only after `backend.persist`
resolves. Error `name` is preserved across the worker boundary
(`errorFromWorker`, `:75-80`) specifically so quota classification still works.
This is a genuinely sophisticated design and the transferables finding below
does **not** apply to it.

### Other properties worth keeping

- Cascade layers are used at all, which is ahead of most codebases even with the
  nesting defect in P0-2.
- `:focus-visible` is used in 11 places rather than `:focus`, matching guidance.
- Dataset ingest genuinely runs off the main thread
  (`src/workers/dataIngestWorker.js`) with progress reporting and `AbortSignal`
  cancellation.
- Object URLs are paired 1:1 with `revokeObjectURL` (`downloads/bytes.js:43/50`,
  `downloads/svg.js:85/92`). No leaks.
- CSP is delivered both as a `<meta>` fallback and as a real header
  (`docker/security-headers.conf`), with each relaxation documented and
  justified. `script-src` correctly forbids `'unsafe-inline'`.
- The slider control (`charts/shared/controls/factories.js:150-153`) correctly
  pairs `<output>` with `htmlFor`.
- Panel slot lifecycle uses a `WeakMap` keyed by container element
  (`features/panel/slots/lifecycle.js:20`) so DOM removal frees the entry, and
  its `ResizeObserver` callback is rAF-debounced (`:82-91`).
- The single non-passive listener in the codebase
  (`charts/scatter3d/interaction.js:120`) is deliberate, documented, and
  genuinely calls `preventDefault()`. This is correct.

---

## Priority 0: The Error Channel Is Dead In Production

### Finding

`src/ui/feedback.js:54` resolves `#errors-container`; `:121` and `:138` resolve
`#loading-state`. A repository-wide search finds those IDs in exactly two places:
`src/ui/feedback.js` itself, and `tests/ui/feedback.test.js:31,54,82,92,110,114`,
which constructs them in its own fixture.

Neither ID appears in `index.html` or `about.html`. The tests pass against a DOM
that production never has.

The fallback path at `:55-58`:

```js
export function showError(message, duration = 0) {
	const errorsContainer = document.getElementById('errors-container');
	if (!errorsContainer) {
		showFeedback(message, duration || 2200);
		return;
	}
	// ...role="alert", close button, caller-controlled dismissal
}
```

Verified consequences:

1. **Persistent errors become transient.** The JSDoc documents `duration = 0` as
   "no autodismiss". Because `0` is falsy, `duration || 2200` resolves to 2200.
   Every error the app intends to leave on screen until the user dismisses it
   instead vanishes after 2.2 seconds.
2. **Errors are never announced.** `role="alert"` is set at `:62`, inside the
   unreachable branch. The reachable path is `showFeedback` (`:21-37`), which
   builds a bare `div` with no `role` and no `aria-live`. Every toast in the
   application, errors included, is silent to assistive technology.
3. **The close button is unreachable.** Also inside the dead branch (`:67-74`).
4. **`showLoading` and `hideLoading` are no-ops.** Both guard on an element that
   never exists, so the loading spinner is dead code.
5. **The blast radius is the whole app.** 37 occurrences across 9 files,
   including `src/app/applicationInitializer.js`, the top-level error boundary.
   A failure during application start reports through this channel.
6. **An orphan exists in the other direction.** `index.html:55` contains
   `<div id="error-message"></div>`, styled at `messages.css:4-13` with
   `display: none`, which no JavaScript ever writes to.

This is not a modern-platform finding; it surfaced while auditing live regions
against the `accessibility` guide section 8. It is included because it is the
most consequential thing found.

### Recommended direction

Treat as a standalone bug-fix PR ahead of the rest of this document.

The guidance (`accessibility` section 8) recommends centralizing on one `polite`
region and one `assertive` region per page rather than scattering live regions.
That maps cleanly onto the existing API surface:

- Add the two live regions to `index.html` and `about.html` as real markup,
  covered by the existing `tests/staticHtml/parity.test.js` owner-constant
  pattern so they cannot silently disappear again.
- Route `showFeedback` through the `polite` region and `showError` through
  `assertive` (or `role="alert"`).
- Decide deliberately whether `showLoading` should exist. If the progress toast
  (`showProgress`, `:171-275`) has superseded it, delete it and its tests rather
  than wiring up dead UI.
- Either delete the orphaned `#error-message` div or make it the error region.

**Risk.** Low for the fix itself. The real risk is behavioral: errors currently
disappear after 2.2 seconds, and making them persist is a visible UX change that
may surface error paths nobody realized were firing. Recommend landing the live
regions first, observing, then changing the dismissal semantics separately.

**Test gap to close.** The existing test suite asserts against a fixture DOM it
builds itself. Any fix should add a parity test that the production HTML contains
the elements `feedback.js` depends on, following the pattern already established
in `tests/staticHtml/parity.test.js`.

---

## Priority 0: Cascade Layers Have A Silent Nesting Collision

### Finding

`src/styles/app.css:5` declares the intended order:

```css
@layer foundation, controls, data-view, visual-output, feedback;
```

and imports `base.css` into `layer(foundation)`. `base.css:3` imports
`chrome.css`. `chrome.css:5` then **re-declares** `@layer foundation;` and
imports into it. The result is a nested layer named `foundation.foundation`,
observable in the built bundle as a literal:

```css
@layer foundation{@layer foundation{
```

The layer graph as actually constructed:

```
@layer foundation
├── @layer foundation.foundation
│     variables.css, layout.css, responsive.css, header-nav.css, settings.css
└── (unlayered within foundation)
      animations.css, collapsed.css
@layer controls        buttons, upload, columns, chart-controls, chart-picker
@layer data-view       table, dataset-workspace
@layer visual-output   chart-output, panel
@layer feedback        messages
(no layer)             about.css
```

Because unlayered styles win against layered styles at the same nesting level,
`animations.css` and `collapsed.css` outrank every file in `foundation.foundation`
for normal declarations, and lose to them for `!important` declarations. Neither
ordering was designed.

**The visible symptom.** A byte-identical 10-selector ID list is duplicated
verbatim across two files. `collapsed.css:22-31` hides them:

```css
body.sidebar-collapsed .panel-top-label,
/* ... */
body.sidebar-collapsed #btn-back-to-viz {
	display: none !important;
}
```

and `responsive.css:41-50` un-hides the same ten:

```css
body.sidebar-collapsed #btn-back-to-viz {
	display: initial !important;
}
```

This `!important` duel only resolves the way it does *because* of the accidental
nesting. Cascade layers exist to make exactly this unnecessary.

**Supporting evidence that layers are not doing their job:** 22 ID selectors and
5 `!important` declarations survive across the sheets, and
`stylelint.config.mjs:15` disables `no-descending-specificity` with a comment
attributing the exemption to the layer structure:

```js
// CHIVE uses explicit cascade layers and feature bundles, so source order
// does not always map cleanly to selector specificity.
'no-descending-specificity': null,
```

That comment describes a symptom of the defect as though it were a design
property.

### Recommended direction

Three steps, each independently landable:

1. **Remove the re-declaration.** `chrome.css:5` should not declare
   `@layer foundation`. Because `about.html` loads `chrome.css` directly, it
   needs its own layer declaration; the fix is to make that explicit and distinct
   rather than colliding with `app.css`'s.
2. **Give `animations.css` and `collapsed.css` explicit layer assignments** so
   nothing is unlayered-within-foundation by accident. Consider whether
   `collapsed.css` is really `foundation` at all; it encodes UI state and may
   belong in a later layer, which would remove the need for `!important` on its
   own.
3. **Collapse the duplicated ID block.** Ten ID selectors repeated in two files
   is a maintenance hazard independent of the layer question. A single
   `[data-collapsed]` attribute on a common ancestor, or the `:has()` pattern
   already used once at `layout.css:84`, replaces both blocks with one rule and
   removes both `!important` declarations.

After step 3, re-evaluate whether `no-descending-specificity` can be re-enabled
in `stylelint.config.mjs`. If it can, the rule becomes a permanent regression
guard for this whole class of problem.

**Risk.** Medium. Changing layer membership changes cascade resolution, and the
current visual output depends on the accidental ordering in ways that are not
individually documented. This needs visual verification across the collapsed
sidebar state, the 900px breakpoint, and the about page, not just a passing
`npm run lint:css`. Recommend landing step 1 alone first and confirming no visual
change before touching the duplicated block.

**Documentation.** `docs/development/styles.md` describes the intended layer
structure accurately but never mentions the nesting, so it currently documents
something that is not what ships. It needs updating alongside the fix.

---

## Priority 1: First Paint Is Gated On The Entire Module Graph

### Finding

`index.html:14` and `about.html:15` contain:

```html
<style>body { visibility: hidden }</style>
```

Visibility is restored only from JavaScript, at `src/services/i18nService.js:95`
inside `initializeI18n()`, with error-path fallbacks at
`src/app/applicationInitializer.js:105` and `src/entries/about.js:22`.

A FOUC guard has become a blank-screen guard. Nothing paints until the entire
module graph downloads, parses, executes, and i18n initialization completes.

Measured against the raw-static deployment target:

| Metric | Value |
|---|---|
| Modules reachable from `src/entries/app.js` | **176** |
| Total raw bytes in that graph | **~3.5 MB** |
| Eager vendor JavaScript on `index.html` | **2,721,886 bytes** |
| `rel=modulepreload` hints | **0** |
| Dynamic `import()` calls in `src/` | **1** |

The eager vendor breakdown:

| File | Bytes | Needed by |
|---|---|---|
| `vendor/three/three.core.js` | 1,443,111 | scatter3d only |
| `vendor/three/three.module.js` | 650,208 | scatter3d only |
| `vendor/d3/d3.js` | 590,311 | all charts |
| `vendor/banana-i18n/banana-i18n.js` | 38,256 | all pages |

**2.09 MB of Three.js loads eagerly for one of nine charts.** It is statically
reachable via a namespace import at
`src/charts/scatter3d/renderers/three.js:21`, pulled in through
`applicationInitializer.js` → `renderCoordinator` → `chartsView` →
`renderWorkspaceChart`.

Compounding factors, all specific to unbundled deployment:

- **No `modulepreload`.** In a 176-module graph each module is discovered only
  when its importer finishes parsing, so graph depth converts directly into
  round-trip latency. `modulepreload` exists for precisely this deployment model.
  Baseline Newly available 2023-09 (Safari 17), Widely available since ~2026-03.
- **`Cache-Control: no-cache` on `/src/`** (`docker/default.conf:52-56`). The
  comment explains the reasoning ("App source: no hashed filenames, so revalidate
  rather than long-cache") and it is correct given no build step, but it means
  176 conditional requests on every load.
- **A three-level render-blocking CSS `@import` chain**: `app.css` → `base.css`
  → `chrome.css` → `variables.css`. The `performance` guide is explicit that
  `@import` creates sequential request chains that delay CSSOM construction. In
  bundled mode Vite flattens this; in raw-static mode, which is what ships, it
  does not.
- **Both locales load unconditionally.** `src/services/i18nService.js:12-13`
  inlines `en.json` (33,597 B) and `pt-BR.json` (36,216 B) via import
  attributes, so ~70 KB of unused translations load regardless of active locale.
- **`debugApi.js` is eager** on the app page and itself pulls state, feedback,
  uiManager, renderCoordinator, and datasetController.

### Recommended direction

Ordered by ratio of benefit to risk. All are raw-ESM compatible.

1. **Dynamic-`import()` Three.js behind the scatter3d render path.** This is the
   single largest win available: ~2.09 MB removed from the eager graph for eight
   of nine charts. The codebase already has the pattern at
   `services/persistence/backends/workerBackend.js:116`, and `CLAUDE.md` permits
   dynamic import (it bans bare specifiers and Vite-only suffixes, not `import()`).
   The scatter3d renderer already returns a failure result for
   `webgl-unavailable`, so it has an async-failure shape to build on.
2. **Add `modulepreload` hints** for the hot path modules. Note the maintenance
   hazard: hand-maintained hints drift from the real import graph. The repo
   already has `scripts/runtime-manifest.mjs` walking the module graph for the
   asset inventory, which is the natural place to generate them from.
3. **Replace the CSS `@import` chain with ordered `<link>` tags.** Keep the
   `@layer` declaration in the first sheet so layer order is still established
   before any rules load. This interacts with P0-2 and should land after it.
4. **Reconsider the visibility gate.** Paint the shell immediately and let i18n
   swap text in, or scope the gate to text-bearing elements only. Worth
   confirming what the gate was originally guarding against before removing it.
5. **Dynamic-import the non-active locale.**

**Risk.** Item 1 is the highest-value and carries real risk: it makes chart
rendering asynchronous for one chart type, which touches the render coordinator's
scheduling contract and the panel slot lifecycle. It needs its own PR and careful
attention to the dispose-first contract documented at
`charts/scatter3d/renderers/three.js:11-16`. Items 2 through 5 are low risk.

Item 3 must be verified with a raw static server, not `npm run dev`. `CLAUDE.md`
already warns that a Vite-only smoke test is insufficient after import-graph
changes, and this is exactly that case: Vite flattens `@import`, so the bug this
fixes is invisible in dev.

---

## Priority 1: 1.15 MB Of Uncompressed Fonts

### Finding

Verified file sizes under `vendor/fonts/`:

| File | Bytes | Format |
|---|---|---|
| `ibm-plex-sans/IBMPlexSans-VariableFont_wdth,wght.ttf` | 532,740 | TTF |
| `ibm-plex-serif/IBMPlexSerif-SemiBold.ttf` | 161,724 | TTF |
| `ibm-plex-serif/IBMPlexSerif-Bold.ttf` | 161,000 | TTF |
| `ibm-plex-serif/IBMPlexSerif-Regular.ttf` | 160,380 | TTF |
| `ibm-plex-serif/IBMPlexSerif-Light.ttf` | 159,996 | TTF |
| **TTF subtotal** | **1,175,840** | |
| `jetbrains-mono/*.woff2` (4 faces) | 375,048 | WOFF2 |

JetBrains Mono is correctly WOFF2. The IBM Plex faces are raw TrueType.

**They are also not compressed in transit.** `docker/default.conf:26-28`:

```nginx
gzip            on;
gzip_min_length 1024;
gzip_types      text/css text/javascript application/javascript image/svg+xml application/json application/wasm;
```

No font MIME type appears in `gzip_types`, so 1.15 MB of TTF ships byte-for-byte
uncompressed on every cold load. (This does not matter for the WOFF2 files, which
carry their own Brotli compression, which is exactly the point.)

Additional observations:

- Four IBM Plex Serif weights are shipped. `--font-display` is used for headings
  and the logo; there is no evidence all four weights are exercised.
- No `unicode-range` subsetting, though the app ships only `en` and `pt-BR`,
  both Latin.
- No `<link rel="preload" as="font" crossorigin>` for the faces used above the
  fold.
- `vendor/fonts/fonts.css` does correctly set `font-display: swap` on all nine
  faces.

### Recommended direction

1. **Convert the five IBM Plex TTF files to WOFF2.** Universally supported for
   roughly a decade; well inside any support posture. Expect 40 to 50 percent of
   the TTF size, so roughly 600 to 700 KB saved on first load with no
   architectural change. This is the cheapest large win in the document.
2. **Audit which Serif weights are actually used** and drop the unused ones.
   Each is ~160 KB.
3. **Add font MIME types to `gzip_types`** as defense in depth, even after the
   WOFF2 conversion makes it mostly moot.
4. **Consider `unicode-range` subsetting** to Latin. Lower priority than the
   format conversion.
5. **Preload the one or two faces used above the fold**, per the `performance`
   guide. Do not preload all nine; the guide is explicit that over-preloading
   causes network contention.

**Risk.** Very low. Font conversion is mechanical and verifiable by eye. The main
care needed is that `vendor/` is checked-in runtime dependency territory, so the
conversion must go through whatever provenance discipline
`scripts/verify-vendor.mjs` and `vendor/README.md` establish, and `npm run
verify:vendor` must still pass.

---

## Priority 1: Uncapped SVG Joins

### Finding

`src/config/limits.js` sets `ROW_LIMIT = 200000`. Two chart renderers join one
DOM element per row with no cap of their own.

**Scatter** (`src/charts/scatter/renderers/svg.js:186-217`) joins one `<circle>`
per point, then attaches four listeners to each:

```js
group
	.selectAll('circle')
	.data(points)
	.enter()
	.append('circle')
	// ...
	.on('mouseenter', /* ... */)
	.on('mousemove',  event => { moveChartTooltip(event.pageX, event.pageY); })
	.on('mouseleave', /* ... */)
	.on('click',      /* ... */);
```

`buildScatterPoints` (`charts/scatter/data.js:33`) applies no point cap.
Aggregation only happens when both axes are categorical and mode is `'aggregate'`.
A 200,000-row numeric-by-numeric scatter therefore produces 200,000 SVG elements
and 800,000 event listeners.

**Network** (`src/charts/network/renderers/svg.js:250,280,387`) joins uncapped
lines, circles, and labels, and additionally runs a live `forceSimulation`
(`:158`) with a tick handler (`:439`).

The contrast is instructive. `scatter3d` is the only chart with a render budget:
`maxPoints = 50000` in `config/charts/definitions/scatter3d.js:16`, enforced by
extrema-preserving stride sampling at `charts/scatter3d/data.js:108-123`. The TIN
chart bounds cost differently, joining fragments into a single path `d` string
(`charts/tin/renderers/svg.js:202,215,225`) with
`maxSurfaceLeaves = 262144` capping string length rather than element count.

So the codebase has two established budget patterns already. Scatter and network
simply have none.

### Recommended direction

1. **Generalize the existing stride-sampling budget** from `scatter3d/data.js`
   rather than inventing a new mechanism. It already preserves extrema, which
   matters for a data-visualization tool: naive head-truncation would silently
   change the visible shape of the data.
2. **Replace per-element listeners with event delegation.** One listener on the
   container plus an `event.target` lookup removes the 800,000-listener cost
   entirely and is independent of any point cap. This is the larger win of the
   two and lower risk.
3. **Surface truncation in the UI.** The ingest path already reports
   `truncatedFrom` for row limiting; chart-level sampling should be equally
   visible so users are not silently shown a subsample.

**Risk.** Medium, and mostly product rather than technical. A point cap changes
what users see. It needs a deliberate decision on the cap value and on how
truncation is communicated, ideally alongside whoever owns the visualization
semantics. Event delegation (item 2) has no such concern and could land first.

---

## Priority 1: Render Scheduling Flushes Before Paint

### Finding

`src/app/renderCoordinator.js` coalesces renders onto microtasks:

- `scheduleRegion()` at `:81` uses `Promise.resolve().then(...)`
- `scheduleFullRefresh()` at `:117` uses the same

A microtask flushes before the next paint, so a heavy `refreshView()` extends the
current task rather than yielding to the browser. `refreshView()` (`:257-275`)
runs dataset list, workspace, chart controls, and panel rendering in one
synchronous pass. This is the long-task pattern the `performance` guide describes
under INP.

Feeding that pass, `features/datasetWorkspace/views/tablePreviewView.js:31-68`
builds the preview table with no virtualization. At the maximum preview setting
(`PREVIEW_MAX_ROWS = 1000`, offered in the `index.html:132-139` selector) and a
wide dataset, this is on the order of 51,000 elements constructed synchronously.
The table is assembled detached and attached once (`:86-87`), which is the right
call and avoids repeated reflow, but the construction itself is unbroken.

The only rate limiting in the render path is
`applicationInitializer.js:56`, which wraps live preview rendering in a 120 ms
`setTimeout`-based throttle.

### Recommended direction

1. **Move the coalesced flush to `requestAnimationFrame`.** Widely available for
   a decade. The scheduler already has the right shape (a dirty-region `Set` with
   a shared "full wins" guard); only the flush trigger changes. This lets the
   browser paint and process input between state change and render.
2. **Consider chunking the table build** for large previews, yielding between
   chunks. Note the honest caveat: `scheduler.yield()` is the guidance's preferred
   primitive but has no Safari support, so it is watch-list under this posture.
   The documented `setTimeout` fallback works today, and the repo already has a
   throttle utility to build on.
3. **Virtualization is not recommended right now.** The preview is explicitly
   bounded and defaults to 10 rows. Chunking addresses the tail case without
   introducing a virtualized-scrolling maintenance burden.

**Risk.** Medium for item 1. Moving from microtask to rAF changes render timing
in ways tests may be coupled to, and the header comment at
`renderCoordinator.js:41-44` documents the current coalescing contract
deliberately. Expect test churn. Verify that no code path depends on a render
having completed synchronously before the next statement, particularly
`runFullRefreshNow()` (`:134-144`), which is intentionally synchronous at boot
and should stay that way.

---

## Priority 1: Layout Thrashing In The Pointer Path

### Finding

`src/charts/shared/tooltip/tooltip.js:138-166` (`moveChartTooltip`) reads layout
and then writes it, in the same function:

```js
const rect = el.getBoundingClientRect();          // :140  read
const vw = window.innerWidth;                     // :141  read
const vh = window.innerHeight;                    // :142  read
// ...flip and clamp arithmetic...
el.style.left = `${left}px`;                      // :165  write
el.style.top  = `${top}px`;                       // :166  write
```

It is called from the scatter `mousemove` handler
(`charts/scatter/renderers/svg.js:199-202`) with no throttling, so every pointer
move forces a synchronous layout.

A second instance: `features/datasetWorkspace/chartControls/chartControlsController.js:195-196`
reads `getBoundingClientRect().top`, writes `container.scrollTop`, then calls
`focus()`, as part of manual scroll anchoring across sidebar re-renders.

For contrast, `features/panel/layout/resize.js:144,209` does this correctly:
`getBoundingClientRect()` is read once at drag start and cached, and the
`mousemove` handlers do arithmetic only.

### Recommended direction

1. **Cache the viewport reads.** `window.innerWidth` and `innerHeight` do not
   change during a pointer sequence; read them on show, not on move.
2. **Throttle position writes to `requestAnimationFrame`.** Pointer events can
   fire faster than the display refreshes, so this is free accuracy.
3. **Cache the tooltip's own dimensions** and re-measure only when content
   changes, not on every move.

**What is deliberately not recommended:** migrating the flip-and-clamp logic to
CSS anchor positioning. Anchor positioning is not shipped in any browser engine
other than Chromium, and is not Baseline at all. The manual math stays. This is
recorded in the watch-list so it is not re-proposed.

Similarly, moving the tooltip into the top layer via the Popover API would remove
the `z-index: 9999` at `chart-output.css:160` and the manual stacking, but the
Popover API is Baseline Newly available (2025-01-27) and therefore watch-list
under this posture.

**Risk.** Low. These are local optimizations to one function with no contract
change.

---

## Priority 1: Accessibility Gaps

Each item below is fixable with Baseline Widely available features. Grouped
because they share a review and test surface.

### Finding: the tab UI has no tab semantics, and two implementations

`index.html:93-117` renders three `<button class="result-tab">` and three
`<div class="result-panel">`. There is no `role="tablist"`, no `role="tab"`, no
`role="tabpanel"`, no `aria-selected`, no `aria-controls`, and no arrow-key
navigation. A screen-reader user gets three unrelated buttons and three unrelated
regions.

Worse, two implementations maintain the same elements and disagree on mechanism:

- `src/app/uiManager.js:68-70` sets `panel.hidden = ...`
- `src/features/datasetWorkspace/views/tabsView.js:95-97` toggles an `.active` class

Two sources of truth for one piece of UI state is a defect independent of the
ARIA question.

### Finding: `inert` is never set

Verified: `inert` appears in the repository only as a comment
(`eslint.config.js:123`) and as a *read* in `dialogFocus.js:65`. It is never set
on any element.

Consequently, behind all five modal dialogs, background content remains in the
accessibility tree and reachable by browser find-in-page. The manual Tab trap in
`dialogFocus.js:73-100` constrains sequential keyboard navigation only; it does
not constrain a screen reader's virtual cursor.

`inert` reached Baseline in April 2023 and is Widely available.

### Finding: four of five dialogs have no accessible name

All five set `role="dialog"` and `aria-modal="true"`. Only
`features/settings/settingsDialog.js:71` sets `aria-labelledby`. The other four
build a visible heading and never associate it:

- `dialogs/chartTypePickerDialog.js:68-74`
- `dialogs/globalFilterDialog.js:343-349`
- `dialogs/joinBuilderView.js:181`
- `dialogs/presetDatasetsView.js:87`

### Finding: `aria-expanded` desync

`index.html:100` declares `aria-haspopup="dialog" aria-expanded="false"` on
`#btn-global-filter`. `views/tabsView.js:120-136` maintains `hidden`, `disabled`,
`aria-disabled`, `dataset.active`, and the `.active` class on that button, but
never `aria-expanded`. It reports "collapsed" the entire time the dialog is open.

### Finding: `role="menu"` promising behavior it does not implement

`index.html:109-112` declares `role="menu"` with three `role="menuitem"` children,
managed by `app/bindings/projectTransfer.js`. The ARIA menu pattern requires
roving tabindex, arrow-key navigation, Home/End, and focus return to the trigger
on close. None are implemented.

The guidance is direct on this: if you set an ARIA role, the element must behave
like that role. A `role`-free set of buttons would be more accessible than a
`role="menu"` that does not behave like a menu.

### Finding: smaller items

- **`<div role="button" tabindex="0">` upload zone** (`index.html:46`) with a
  hand-rolled Enter/Space handler at `datasetController.js:117-122`. A real
  `<button>` provides both for free.
- **No `prefers-reduced-motion`** in any of the 25 stylesheets, against 20
  `transition` declarations and 2 `@keyframes`. Notably `layout.css:65` animates
  `grid-template-columns` and `about.css:117` animates transform on hover. WCAG
  2.3.3.
- **All font sizes are `px`.** `variables.css:53-59` defines the scale from 9px
  to 15px, `body` is a hardcoded `14px` at `:77` (not even using its own token),
  and off-scale literals exist at `table.css:7` (11.5px) and `:61` (10.5px). The
  guidance is explicit: use `rem` so the user's browser font-size preference is
  honored. This compounds badly here, because the smallest text in a data-dense
  app is exactly the text a user is most likely to want scaled.
- **`outline: none` with no replacement** at `upload.css:113-114`
  (`.files-filter-input:focus`). WCAG 2.4.7. One-line fix, and inconsistent with
  the 11 correct `:focus-visible` treatments elsewhere.
- **No `aria-current="page"`** on the nav; `index.html:23` uses `class="active"`.
- **The whole panel canvas is a live region.** `index.html:428` sets
  `aria-live="polite"` on `#panel-layout-canvas`, so every panel re-render
  announces the entire canvas. The guidance warns specifically against noisy
  live regions.
- **`about.html:97`** uses `target="_blank"` without `rel="noopener noreferrer"`.

### Recommended direction

Sequence as three PRs:

1. **Mechanical fixes**, no design decisions: `rel="noopener noreferrer"`,
   `aria-current="page"`, the `outline: none` replacement, `aria-labelledby` on
   the four dialogs, `aria-expanded` sync in `tabsView.js`, `<button>` for the
   upload zone.
2. **`prefers-reduced-motion` and `rem` font sizes.** Both are systematic sweeps
   across the stylesheets. The `rem` conversion should keep the rendered sizes
   identical at default root font size so it is a pure refactor.
3. **Tab semantics and the duplicate implementation.** This one needs a design
   decision first: which module owns tab state. Resolve the `uiManager` /
   `tabsView` split before adding ARIA, or the ARIA will be maintained in two
   places too.

The `inert` finding is deliberately **not** listed here; it is subsumed by the
`<dialog>` migration below, which provides it automatically.

**Risk.** Item 1 is very low. Item 2 is low but touches every stylesheet, so it
wants careful visual diffing. Item 3 is medium and is really an architecture task
wearing an accessibility hat.

---

## Priority 2: Five Hand-Rolled Modals Reimplement `<dialog>`

### Finding

`<dialog>` has been **Baseline Widely available since 2022-03-14**, over four
years. CHIVE uses it nowhere. Verified: zero occurrences of `<dialog>`,
`showModal()`, `::backdrop`, or `closedby` in the repository.

Instead, `src/ui/dialogFocus.js` (251 lines) reimplements the browser's top-layer
behavior in userland:

| Line | Hand-rolled mechanism | Native equivalent |
|---|---|---|
| `:16` | `FOCUSABLE_SELECTOR` string | Browser focus model |
| `:24` | Module-level `stack[]` of open dialogs | Top layer |
| `:73-100` | Tab-wrap trap on capture-phase `document` keydown | `showModal()` focus trap |
| `:117-129` | `document.body.style.overflow = 'hidden'` | `showModal()` scroll lock |
| `:159-165` | `pruneDisconnectedEntries()` | Not needed; `<dialog>` cannot desync |
| `:167-179` | Temporary `tabindex="-1"` injection for initial focus | `autofocus` / native initial focus |

The hardcoded focusable selector at `:16` is missing `details`, `summary`,
`iframe`, `audio[controls]`, `video[controls]`, and `[contenteditable]`. The
existence of `pruneDisconnectedEntries()` is itself evidence: it recovers from
dialogs removed outside the close path, a failure mode the native element cannot
have.

On top of that engine, five dialogs each duplicate the same Escape listener,
backdrop-click identity check, and five-line teardown:

`features/settings/settingsDialog.js`,
`features/datasetWorkspace/dialogs/chartTypePickerDialog.js`,
`.../globalFilterDialog.js`, `.../joinBuilderView.js`, `.../presetDatasetsView.js`.

**This carries a real bug.** Each dialog registers an unconditional
`document`-level Escape handler that never checks whether it is top-of-stack:

```js
const onEscape = event => {
	if (event.key !== 'Escape') return;
	closeDialog('cancel', null);
};
```

`dialogFocus.js` maintains a stack for Tab but not for Escape. With two dialogs
open, one Escape press closes both. `<dialog>` cannot have this bug, because the
top layer defines dismissal order.

There is also a manual z-index ladder documented only in comments: `.join-overlay`
120, `.chart-tooltip` 9999, `.settings-overlay` 11000, `.toast-feedback` 12000,
`.toast-progress` 12100. Note that two dialogs sit at 120, *below* the chart
tooltip at 9999.

Related, and worth folding into the same effort: five `window.alert()` calls in
`joinBuilderView.js:171,354,361,365,372` serve as the join builder's entire
validation error channel, and `window.confirm()` gates destructive project import
at `app/bindings/projectTransfer.js:154`.

### Recommended direction

Migrate to `<dialog>` + `showModal()`, then delete `src/ui/dialogFocus.js`.

What this buys, per the `html` and `accessibility` guides:

- Focus trap, background `inert`, and Escape handling, natively and correctly.
- The `inert` finding from Priority 1 is resolved as a side effect.
- The nested-Escape bug is resolved as a side effect.
- `::backdrop` replaces the manual overlay divs at `upload.css:244-253` and
  `settings.css:35-45`.
- The z-index ladder becomes unnecessary for dialogs.
- `<form method="dialog">` can replace manual close-and-resolve wiring; the four
  Promise-returning dialogs map cleanly onto `returnValue`.

**Sequencing.** Migrate one dialog first as a reference (recommend
`presetDatasetsView.js`, the simplest), confirm the pattern, then follow with the
rest. `dialogFocus.js` can only be deleted after all five migrate.

**Deliberately deferred within this migration:**

- `closedby="any"` for native light dismiss is **not** yet Widely available.
  Keep the existing backdrop-click check until it qualifies.
- Entry and exit animation via `@starting-style` and
  `transition-behavior: allow-discrete` is Baseline Newly available (2024-08-06),
  so it is watch-list. Dialogs appear without transition for now, which is what
  they do today anyway.

**Risk.** Medium, and mostly in the details rather than the concept. Specific
things to watch:

- `<dialog>` positioning and sizing differ from a flex-centered fixed overlay;
  the `width: min(640px, 96vw)` / `max-height: 90vh` patterns need re-testing.
- `showModal()` requires the element to be connected to the DOM; the current code
  creates and appends dialogs imperatively at call time, which is compatible but
  changes ordering.
- Tests currently assert against the hand-rolled focus behavior and will need
  rewriting against native behavior. That is a real cost and should be scoped
  into the estimate.
- jsdom's `<dialog>` support has historically lagged; verify the test environment
  handles `showModal()` before committing to the approach across all five.

---

## Priority 2: Hand-Rolled CSS The Platform Now Does Natively

Each item states its Baseline status. All listed here are Widely available.

### Finding: RGB channel triplets substitute for `color-mix()`

`variables.css:21-24` defines parallel RGB-channel tokens purely to enable
translucency:

```css
/* RGB channels for translucent fills: rgba(var(--accent-rgb), 0.08) */
--accent-rgb: 26, 71, 42;
--success-rgb: 45, 106, 79;
--text-rgb: 28, 26, 23;
```

Each duplicates a hex token defined a few lines above, creating a class of bug
where the two drift apart. `color-mix(in oklab, var(--accent) 8%, transparent)`
expresses the same thing from the single source token. Baseline Newly available
2023-05, Widely available since ~2025-11.

### Finding: no `color-scheme`

Verified absent from all 25 stylesheets. CHIVE has one hard-coded light palette,
which is a legitimate product choice and this audit does **not** recommend
building dark mode.

But `color-scheme` is a separate concern. Without it, on a dark-mode operating
system the browser renders native `<select>` dropdowns, scrollbars, and form
controls in dark styling against CHIVE's fixed light chrome. Declaring
`color-scheme: light` on `:root` pins UA-rendered surfaces to match the design.
One line. Widely available for years.

This matters more than usual here because the chart controls sidebar is built
almost entirely from native `<select>` and `<input>` elements
(`charts/shared/controls/factories.js`).

### Finding: `vh` units with no dynamic-viewport variants

16 uses of `vh`/`vw`, zero of `dvh`/`svh`/`lvh`. The load-bearing ones:

- `variables.css:79` — `min-height: 100vh` on `body`
- `layout.css:75` — `height: calc(100vh - 52px)` on the sticky sidebar
- `layout.css:64,88` — `min-height: calc(100vh - 52px)`
- `upload.css:257`, `settings.css:49` — `max-height: 90vh` on dialog shells

On mobile, `vh` resolves against the largest viewport, so these overflow when the
browser's address bar is expanded. Dynamic viewport units have been Baseline
since 2022-12-05.

### Finding: zero container queries

8 media-query blocks, all `max-width`, all desktop-first. No `@container`, no
`container-type`.

This is a notable mismatch for CHIVE specifically: the sidebar is user-collapsible
(340px to 74px via a CSS custom property swap), and panel slots are user-resizable
via drag. Components inside those containers currently cannot respond to their own
width; they can only respond to viewport width, which is the wrong signal.
Container queries have been Baseline since 2023-02-14.

The manual substitute is visible in the nine chart renderers, each doing
`Math.max(container.clientWidth || FALLBACK, 320)` at render entry.

### Finding: `:has()` used once

`layout.css:84` is the only occurrence:

```css
.panel-left:has(#sidebar-panel-data.active) { /* ... */ }
```

This is exactly the right pattern and it is applied once. Several JS class-toggles
elsewhere express parent-depends-on-child-state relationships that `:has()` could
own instead. Baseline since 2023-12.

### Finding: `style.display` as state mechanism

Roughly 35 sites write `element.style.display` directly, including all nine
`charts/*/workspaceSection.js`, `views/chartsView.js:119-125`, and
`charts/shared/controls/grouping.js:61,73`. A minority of the codebase uses the
`hidden` property correctly (`app/uiManager.js:68-70,131`,
`app/bindings/projectTransfer.js:112`).

Two problems: the mechanism is inconsistent across the codebase, and inline
`style.display` writes are invisible to CSS state selectors, which forecloses the
`:has()` and container-query patterns above.

### Finding: no `@supports` anywhere

Zero occurrences. There is no established progressive-enhancement pattern in the
codebase, which matters as soon as any watch-list feature is adopted.

### Recommended direction

Land as one "CSS modernization" tranche, in this order:

1. `color-scheme: light` on `:root`. One line, immediate correctness win.
2. `dvh` conversion for the four load-bearing `vh` uses.
3. `color-mix()` replacing the RGB triplets, deleting the parallel tokens.
4. Standardize on the `hidden` property (or a `data-*` attribute) instead of
   `style.display`, which unblocks 5 and 6.
5. Container queries for the sidebar and panel slot components.
6. Broader `:has()` adoption where it replaces a JS class toggle.

**Risk.** Items 1 through 3 are low risk and independently verifiable. Item 4 is
a wide mechanical sweep across ~35 sites and 9 chart packages, so it wants its own
PR and careful attention to the chart package boundary rules in `CLAUDE.md`. Items
5 and 6 are design work, not mechanical, and should not be bundled with the rest.

Note that item 3 interacts with P0-2: changing color tokens while the layer graph
is still miscomposed makes visual regressions harder to attribute. Land P0-2 first.

---

## Priority 2: Forms Have No Constraint Validation

### Finding

There is not a single `<form>` element in the codebase. Verified zero occurrences
of `checkValidity`, `reportValidity`, `setCustomValidity`, `validationMessage`,
`required`, `:invalid`, `:valid`, `:user-valid`, and `:user-invalid`.

Validation is entirely imperative, and in one case hostile:

**Join builder** (`dialogs/joinBuilderView.js:350-374`) uses four sequential
`window.alert()` calls as its complete validation error channel: same-file, empty
keys, key-count mismatch, empty columns. A blocking OS-level modal is the least
accessible and least dismissible feedback mechanism available. The same rules are
duplicated in `workflows/joinDatasets.js:88,103`.

**Global filter** (`dialogs/globalFilterDialog.js:72-105`) binds
`input[type=number]` elements to filter bounds but sets **no `min`, `max`, or
`step` attributes at all**. Raw strings are stored and normalization is deferred
to `finalizeGlobalFilterDraft` (`:461`), so the browser cannot help and the user
gets no feedback until commit.

By contrast, `charts/shared/controls/factories.js:92-113` does set `min`/`max`/`step`
on its number inputs, but nothing ever validates against them.

`:user-valid` and `:user-invalid` reached Baseline Newly available in October 2023
and Widely available in April 2026, so they are in posture. They are the correct
styling hook precisely because, unlike `:valid`/`:invalid`, they only match after
user interaction and so avoid flagging empty required fields on open.

### Recommended direction

1. **Replace the `window.alert()` chain in the join builder** with inline field
   errors. This is the highest-value item and is worth doing even without
   adopting constraint validation, because `alert()` is a genuinely poor
   experience.
2. **Set `min`/`max`/`step` on the global filter numeric inputs** so the browser
   participates.
3. **Consider wrapping dialog bodies in `<form method="dialog">`** as part of the
   `<dialog>` migration above. The two efforts are natural companions:
   `method="dialog"` gives native close-with-value, and a real `<form>` unlocks
   constraint validation.
4. **Style with `:user-valid`/`:user-invalid`**, and per the
   `accessible-error-announcement` guide, keep `aria-invalid` synchronized with
   the visual state so screen-reader users get feedback at the same moment
   sighted users do.

**Risk.** Low to medium. Item 1 is self-contained. Item 3 depends on the
`<dialog>` migration and should not be started before it. Note that the existing
validation rules are duplicated between the dialog and the workflow module; the
refactor should resolve that duplication rather than adding a third copy.

---

## Priority 2: Two Input-Event Eras For Identical Controls

### Finding

Two visually identical drag handles use different event models:

- `features/datasetWorkspace/chartControls/chartHeightResize.js:50-53,111-136`
  uses Pointer Events (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`)
  with `touch-action: none` at `chart-output.css:125`. Touch and pen work.
- `features/panel/layout/resize.js:124-127,143+` uses Mouse Events
  (`mousedown`/`mousemove`/`mouseup`). **Panel resize is desktop-mouse-only.**

The first file's own header comment at `:96-101` acknowledges this, noting it
"Mirrors `resize.startBlockHeightResizeDrag` but with Pointer Events (touch and
pen included)". The two were never unified.

Related: `features/panel/views/panelView.js:63,155` calls
`matchMedia('(min-width: 901px)').matches` as a read-only check with **no
`change` listener**, so resizing the window across the 901px boundary does not
re-evaluate drag-and-drop wiring until the next panel render.

### Recommended direction

1. Port `features/panel/layout/resize.js` to Pointer Events, using
   `chartHeightResize.js` as the in-repo reference. Pointer Events have been
   Widely available for years.
2. Add a `change` listener to the `matchMedia` query so the desktop/touch
   drag-and-drop switch re-evaluates on resize.
3. While there, consider `addEventListener(..., { signal })` with an
   `AbortController` for the drag listener cleanup. The codebase has three
   `AbortController` instances but uses none for listener teardown; the manual
   `removeEventListener` pairs at `resize.js:186-188,223-225` are exactly the
   case it simplifies.

**Risk.** Low. Pointer Events are a superset of the mouse model for this use.
The main verification need is touch testing, which the current code cannot have
been receiving.

---

## Priority 2: Platform APIs Never Adopted

### Finding: no storage quota management

`navigator.*` appears nowhere in `src/` except `window.devicePixelRatio`.
Specifically, `navigator.storage.estimate()` and `navigator.storage.persist()`
are never called.

Quota is handled reactively, only after a write fails, at
`services/persistence/errors.js:44-47`:

```js
function isQuotaError(error) {
	return error?.name === 'QuotaExceededError'
		|| String(error?.message || '').toLowerCase().includes('quota');
}
```

For an application whose entire value proposition is browser-persisted projects,
this is the most consequential gap in this section. The user finds out they are
out of space at the moment their save fails. Worse, without `persist()` the
origin's storage is evictable, so a browser under storage pressure can silently
delete a user's projects.

`navigator.storage` reached Widely available around March 2026 (Safari 17,
September 2023).

### Finding: no WebGL context-loss recovery

`charts/scatter3d/renderers/three.js` calls `renderer.forceContextLoss?.()` on
teardown (`:91`), which is correct and proactive. But there is no
`webglcontextlost` or `webglcontextrestored` listener anywhere, so a context lost
externally (GPU reset, driver update, tab backgrounding on some platforms) leaves
a permanently blank chart with no recovery path and no user-facing explanation.

This is the one gap in an otherwise exemplary file.

### Finding: ingest worker does not use transferables

`services/dataIngestService.js:214` posts the entire file text into the worker
and receives the entire normalized row array back, both by structured clone, with
no transfer list.

**This finding does not apply to the persist worker**, which already avoids
O(rows) cloning through reference-keyed payload dedup
(`workerBackend.js:135-183`). The ingest path is the one with headroom.

### Finding: joined datasets bypass the worker

Uploads go through `dataIngestWorker`. But `workflows/joinDatasets.js:127` calls
the synchronous `processData` on the main thread, as does
`workflows/loadPresetDataset.js:72`.

The preset case is justified and documented ("Inline presets are tiny demo
arrays, sync processData is cheap"). The join case is not: a join of two large
datasets can produce an arbitrarily large result and freezes the tab, while an
upload of the same size does not. This is an inconsistency in the threading model
rather than a platform-API gap, but it surfaced during the same sweep.

### Finding: no service worker, no web manifest

Neither exists. Worth stating plainly because the asset model invites the
opposite assumption: CHIVE self-hosts all dependencies and has no runtime network
requirement, which makes it *offline-capable in principle*, but it is not
installable and will not load without a network round-trip to the origin.

Whether to close this is a product decision, not a technical one, and this audit
does not recommend either way. It is recorded so the gap is explicit.

### Recommended direction

Ordered by value:

1. **Adopt `navigator.storage.estimate()`** for proactive quota reporting, and
   call `navigator.storage.persist()` to request eviction resistance. Surface
   remaining quota in the settings dialog, which already exists and currently has
   only two settings.
2. **Add `webglcontextlost`/`webglcontextrestored` handling** to the scatter3d
   renderer, with a user-visible message and a re-render path.
3. **Route joins through the ingest worker**, or document explicitly why they
   stay synchronous.
4. **Consider transferables for the ingest worker** payloads. Lower priority than
   the above; measure first, since structured clone of a string is not
   obviously the bottleneck.

**Risk.** Item 1 is low risk and high user value. Item 2 is low risk. Item 3 is
medium and touches the workflow layer's error routing. Item 4 should not be done
without measurement.

---

## Cross-Cutting: No Browser Support Policy Exists

### Finding

Nothing in the repository declares a browser support target. There is no
`browserslist` key, no policy line in `CLAUDE.md`, `AGENTS.md`,
`CONTRIBUTING.md`, or `docs/development/`.

The `modern-web-guidance` skill explicitly asks for one, and flags several
environmental cues that should prompt documenting it. CHIVE has the strongest
possible cue: a raw-ESM, no-build-step, checked-in-vendor runtime model that
already presupposes evergreen browsers.

Without a policy, every feature adoption decision is re-argued from scratch, and
the answer is unstable across contributors and across sessions. This audit could
not have been written without first fixing a posture, which is itself the
argument for recording one.

### Recommended direction

Add a policy line to `CLAUDE.md`, adjacent to the existing Runtime Constraints
section. Suggested wording matching the posture this audit assumed:

> **Browser Support:** Baseline Widely available. Adopt web platform features
> only once they have been Baseline for roughly 2.5 years. Features that are
> Baseline Newly available may be used only behind an `@supports` guard or
> feature detection with a working fallback. Do not add polyfills or external
> dependencies to reach a feature early.

This is the cheapest change in the entire document and it makes every other
recommendation decidable without re-argument.

**Risk.** None. It is a documentation change that formalizes what the runtime
constraints already imply.

---

## Watch-List: Deliberately Deferred Features

These are features the guidance recommends that CHIVE could benefit from, but
which do **not** qualify under the Baseline Widely available posture. Recorded
with dates so they can be revisited rather than rediscovered.

| Feature | Baseline status | Est. Widely available | What it would replace in CHIVE |
|---|---|---|---|
| Popover API | Newly, 2025-01-27 | ~2027-07 | Chart tooltip top-layer promotion; the `z-index: 9999` at `chart-output.css:160`; the project dropdown menu |
| `@starting-style` | Newly, 2024-08-06 | ~2027-02 | The rAF layout-flush hack at `ui/feedback.js:210-213` |
| `transition-behavior: allow-discrete` | Newly, 2024-08-06 | ~2027-02 | The hardcoded 200ms exit `setTimeout` at `ui/feedback.js:263-265` |
| `overlay` property | Limited (Chromium only) | Unknown | Top-layer exit animation correctness |
| `content-visibility` | Newly, 2025-09-15 | ~2028-03 | Deferred rendering for the nine off-screen chart blocks |
| `scrollbar-gutter` | Newly, 2024-12-11 | ~2027-06 | Layout shift when scrollbars appear in the sidebar |
| `scrollbar-width` / `scrollbar-color` | Newly, ~2024-12 | ~2027-06 | Scrollbar theming to match the light palette |
| Invoker commands (`command`/`commandfor`) | Newly, 2025-12-12 | ~2028-06 | Declarative dialog open/close wiring |
| `light-dark()` | Newly, 2024-05-13 | ~2026-11 | Only relevant if dark mode is ever built |
| `@property` | Newly, 2024-07-09 | ~2027-01 | Typing the JS-written custom properties in `panel.css:364-385` |
| `@scope` | Newly, 2024-07-09 | ~2027-01 | The `about.css` unlayered-override problem |
| `text-wrap: balance` / `pretty` | Newly, ~2024-05 | ~2026-11 | Chart titles and table headers |
| `field-sizing: content` | Not Baseline | Unknown | Auto-sizing filter and search inputs |
| `interpolate-size` / `calc-size()` | Chromium only | Unknown | The `max-height: 0 → 2000px` magic-number accordion at `chart-controls.css:204-214` |
| `closedby="any"` on `<dialog>` | Newly, very recent | Unknown | Manual backdrop-click checks in five dialogs |

Two features have **engine gaps regardless of Baseline age** and are deferred for
that reason rather than recency:

| Feature | Gap | What it would replace |
|---|---|---|
| `overflow-anchor` | No Safari support | Manual scroll anchoring at `chartControlsController.js:125,170,195-196` |
| `scheduler.yield()` | No Safari support | Task chunking for the table build; the documented `setTimeout` fallback works today |

And one is not shipped anywhere outside Chromium:

| Feature | Status | What it would replace |
|---|---|---|
| CSS anchor positioning | Chromium only, not Baseline | The full flip-and-clamp algorithm at `charts/shared/tooltip/tooltip.js:138-167` and `repositionPinnedTooltip` at `:284-289` |

The anchor-positioning entry is the most consequential deferral in this table.
It is the single feature that would delete the most hand-rolled geometry code in
CHIVE, and it is the furthest from being usable. Recheck annually.

---

## Deliberately Not Recommended

Recorded with reasons so they are not re-proposed.

**Dark mode.** CHIVE has one hard-coded light palette and no theme setting. That
is a legitimate product decision, and the audit found no evidence it is causing
problems. The `color-scheme: light` recommendation above is a separate and much
smaller thing: it makes browser-rendered UI match the existing light design, and
does not imply building a second palette.

**Logical properties.** The guidance recommends `margin-inline` over
`margin-left` and so on. CHIVE uses none. This is recorded as low urgency
because both shipped locales (`en`, `pt-BR`) are LTR, and the guidance itself
cautions against applying logical properties indiscriminately. Revisit only if an
RTL locale is added, at which point it becomes a prerequisite rather than a
nicety.

**Bundling, hashed filenames, and long-cache headers.** The largest available
loading win, and out of scope by explicit decision. The no-build-step runtime
constraint in `CLAUDE.md` is treated as inviolable for this audit. Every loading
recommendation above is deliberately chosen to work without it.

**Replacing BEM naming with `:where()`.** The `css` guide advises against BEM
naming conventions for managing specificity, and `stylelint.config.mjs` enforces
a BEM-style class pattern. These do not actually conflict. CHIVE's BEM usage is a
*naming* convention for readability, not a *specificity* mechanism; specificity
is managed by cascade layers, which is what the guide recommends. No change
warranted. The real specificity problem is P0-2, which is about layer composition,
not naming.

**Virtualizing the preview table.** The preview is explicitly bounded
(`PREVIEW_MAX_ROWS = 1000`, default 10). Chunked construction addresses the tail
case without the ongoing maintenance cost of a virtualized scroller.

**Web components / shadow DOM.** Not raised by any guide finding, and the
existing per-chart package model already provides encapsulation at the module
level. Introducing shadow DOM would complicate the cascade-layer architecture for
no identified benefit.

---

## Suggested Sequencing

Tranches sized to be independently reviewable, each branching from `develop`.

| # | Tranche | Contents | Risk |
|---|---|---|---|
| 1 | **Error channel fix** | P0-1. Live regions in static HTML, parity test, decide `showLoading` fate | Low |
| 2 | **Support policy** | `CLAUDE.md` browser-support line | None |
| 3 | **Layer composition fix** | P0-2 step 1 only: remove the `chrome.css` re-declaration, verify no visual change | Medium |
| 4 | **Layer cleanup** | P0-2 steps 2 and 3: explicit layers, collapse the duplicated ID block, re-enable `no-descending-specificity` if possible | Medium |
| 5 | **Font conversion** | TTF to WOFF2, weight audit, `gzip_types`, selective preload | Low |
| 6 | **Mechanical a11y** | P1 accessibility item 1: `rel=noopener`, `aria-current`, `aria-labelledby` ×4, `aria-expanded` sync, focus outline, `<button>` upload zone | Low |
| 7 | **Reduced motion + rem** | P1 accessibility item 2, stylesheet-wide sweeps | Low |
| 8 | **CSS modernization** | `color-scheme`, `dvh`, `color-mix()` | Low |
| 9 | **Three.js dynamic import** | P1 loading item 1, the largest single win | Medium |
| 10 | **Loading hygiene** | `modulepreload`, CSS `@import` flattening, locale splitting. Verify on a raw static server | Medium |
| 11 | **Event delegation** | P1 SVG joins item 2, independent of any point cap | Low |
| 12 | **Pointer Events unification** | P2 input eras, plus `matchMedia` change listener | Low |
| 13 | **Storage quota** | `navigator.storage.estimate()` and `persist()`, surfaced in settings | Low |
| 14 | **`<dialog>` migration** | One reference dialog, then the remaining four, then delete `dialogFocus.js` | Medium |
| 15 | **Tab semantics** | Resolve the `uiManager` / `tabsView` ownership split first, then add ARIA | Medium |
| 16 | **Render scheduling** | Microtask to rAF, table chunking | Medium |
| 17 | **Chart point budgets** | Needs a product decision on cap values and truncation UX | Medium |

Tranches 1 through 8 are largely independent and could proceed in parallel.
Tranche 4 depends on 3. Tranche 8 should follow 4 so visual regressions remain
attributable. Tranche 14 subsumes the `inert` finding and should precede any
further dialog work. Tranche 15 is an architecture task before it is an
accessibility task.

---

## Appendix: Verification Notes

Claims of absence in this document were verified by repository-wide search over
non-`node_modules`, non-`vendor`, non-`dist`, non-`coverage` paths at `9fcc1ad`:

- No `<dialog>`, `showModal()`, `popover`, `anchor-name`, `position-anchor`,
  `@container`, `container-type`, `@starting-style`, `content-visibility`,
  `prefers-reduced-motion`, `color-scheme` (as CSS), `light-dark()`,
  `color-mix()`, `dvh`, `svh`, or `scrollbar-gutter` anywhere in `src/`. The only
  `color-scheme` matches are D3 chart palette identifiers in i18n catalogs and
  chart controls, not the CSS property.
- `inert` is never set. It appears only as a comment in `eslint.config.js:123`
  and as a read in `ui/dialogFocus.js:65`.
- `aria-labelledby` is set exactly once, at `features/settings/settingsDialog.js:71`.
- No `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, or
  `aria-current` anywhere.
- `#errors-container` and `#loading-state` appear only in `src/ui/feedback.js`
  and `tests/ui/feedback.test.js`.

Font sizes, vendor sizes, and the `gzip_types` and `Cache-Control` directives
were read directly from the filesystem and `docker/default.conf` rather than
inferred.

Baseline dates are as reported by the `modern-web-guidance` catalog version
recorded in the status table. "Widely available" is computed as Baseline Newly
available plus 30 months, per the Baseline definition. Estimated dates in the
watch-list should be re-verified rather than trusted at face value when the time
comes.
