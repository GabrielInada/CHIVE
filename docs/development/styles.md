# Stylesheet Organization and Feature Ownership

| Field | Value |
|---|---|
| Audience | Contributors changing CSS, layout, responsive behavior, or feature styling |
| Source of truth | Static page links, explicit cascade layers, and the feature ownership map below |
| Update when | CSS files, layers, ownership, or responsive breakpoints change |

## Delivery model

CHIVE serves CSS directly. Runtime stylesheets must not contain `@import`;
imports create serial request chains on raw static hosting. Each page links its
required leaf stylesheets in cascade order.

`src/styles/layers.css` contains only the canonical order:

```css
@layer foundation, controls, data-view, visual-output, feedback;
```

Every shared leaf file wraps its rules in exactly one of those layers. The
About page loads `about.css` last and unlayered so its page-specific rules can
override shared chrome intentionally.

Tests in `tests/styles/cascadeLayers.test.js` lock the exact page link order,
reject runtime CSS imports and nested layer names, and require an explicit layer
on every shared leaf stylesheet.

## Page link sets

`index.html` loads:

```text
layers.css
variables.css
animations.css
layout.css
collapsed.css
responsive.css
header-nav.css
settings.css
buttons.css
upload.css
columns.css
chart-controls.css
dataset-workspace.css
table.css
chart-output.css
chart-picker.css
panel.css
messages.css
```

`about.html` loads the shared subset:

```text
layers.css
variables.css
layout.css
responsive.css
header-nav.css
settings.css
messages.css
about.css
```

Keep source order meaningful inside a layer. A base component selector should
normally precede its state and interaction selectors.

## Ownership map

### Foundation

| File | Purpose |
|---|---|
| `variables.css` | Color, typography, spacing, radius, and duration tokens; global box sizing |
| `animations.css` | Application reveal animation |
| `layout.css` | Fixed header, workspace grid, sidebar container, and shared structural rules |
| `collapsed.css` | Sidebar presentation derived from the toggle's `aria-expanded` state |
| `responsive.css` | Compact header and collapsible workspace controls at 900px and below |
| `header-nav.css` | Shared top navigation and its 900px adaptation |
| `settings.css` | Shared Settings entry and dialog presentation |

### Controls

| File | Owner | Purpose |
|---|---|---|
| `buttons.css` | Shared | Button variants |
| `upload.css` | Dataset workspace | Upload, file list, join, and sample dataset controls |
| `columns.css` | Dataset workspace | Column selection and filter controls |
| `chart-controls.css` | Dataset workspace | Chart-control sections and widgets |

### Data view

| File | Purpose |
|---|---|
| `dataset-workspace.css` | Empty/data states, result tabs, global filter, and workspace dialogs |
| `table.css` | Preview and statistics tables |

### Visual output

| File | Purpose |
|---|---|
| `chart-output.css` | Chart containers, resize handles, notices, and tooltips |
| `chart-picker.css` | Chart picker trigger, cards, and preview artwork |
| `panel.css` | Panel blocks, slots, layout resizing, and panel container adaptation |

### Feedback

| File | Purpose |
|---|---|
| `messages.css` | Polite notices, persistent errors, progress, the layered `[hidden]` guard, and reduced-motion overrides |

### Page-specific

| File | Loaded by | Purpose |
|---|---|---|
| `about.css` | `about.html` | About hero, team grid, sidebar, footer, and page-level reduced-motion override |

## State and responsive rules

Prefer semantic state already present in the DOM:

- `[hidden]` controls visibility.
- `aria-expanded` controls disclosure and sidebar presentation.
- `active`, `selected`, `dragging`, and `is-resizing` express component state.

Do not mirror an accessible state onto `<body>` solely for CSS.

The sidebar is a named inline-size container. At desktop widths, the workspace
sets its width to 74px when the toggle has `aria-expanded="false"`; a
`@container sidebar (max-width: 120px)` rule hides
`.sidebar-expanded-only`. At 900px and below, the workspace stacks and the
same toggle becomes a labeled controls disclosure, initially closed. Desktop
and narrow disclosure choices are kept separately for the session; neither
changes project state. The header stays in document flow with sticky
positioning, so wrapped navigation does not overlap the workspace.
Native panel drag-and-drop follows fine-pointer availability, keeping mouse
and trackpad dragging usable in narrow or zoomed browser windows.

The panel canvas is a named inline-size container. Below 1000px, multi-column
templates use two readable columns; below 680px they stack. The hero chart and
the final chart of a three-column block span the intermediate layout. These
thresholds use canvas width, independent of the viewport. Reflowed chart heights
follow the available width, chart type, and landscape height bounds. Proportion
and height resize handles are hidden while reflowed. Saved block heights live
in `--panel-block-min-height`, which only the wider layout uses; reflow never
rewrites stored heights, proportions, templates, or slot order. On narrow
screens the dashboard uses document scrolling.

The compact Controls button shares the sidebar toggle state. Block editing
controls use native details disclosures, initially closed on narrow screens;
their open state survives canvas rerenders without entering project state.
Expanded charts use the native modal adapter and a separate slot mount, with
teardown on dismissal. The original chart, focus, and dashboard scroll position
are preserved. Chart tooltips attach inside an open dialog when present.

Dashboard slots and sidebar thumbnails use IntersectionObserver to render near
the viewport. Their CSS reserves space before rendering, and their controls and
accessible chart names remain available. Resize notifications only redraw when
the renderer's width or slot height actually changes; hidden/offscreen slots
catch up when visible. Expanded charts render immediately. SVG export explicitly
materializes every slot first, so deferred charts are included. Browsers without
IntersectionObserver use the eager rendering fallback.

The native modal adapter observes VisualViewport while a dialog is open. Its
height and inset variables constrain surfaces above the software keyboard,
including viewport panning; pinch zoom retains native magnification and panning.
Listeners are removed on close. CSS viewport sizing remains the fallback when
the API is absent. Dialogs respect safe-area insets. Settings, confirmations,
and global filters scroll their content while keeping their primary actions
reachable. Filter fields have associated labels and use a 1rem font on touch
and narrow layouts.

Chart renderers read their own container width, with a 240px drawing floor.
SVGs carry a viewBox; panel charts receive a temporary height derived from
their slot. Workspace chart width changes schedule a redraw without rebuilding
controls or writing state. Narrow categorical axes show fewer labels while
retaining all marks. SVG titles wrap and reserve space above the plot. Pie
legends move below narrow plots and include every category; long legends scroll
locally with a visible hint and a keyboard-focusable region. SVG exports retain
the complete legend. Touch targets for
navigation, chart actions, and inspection controls are at least 44px on narrow
screens or when a coarse pointer is available.

Pie and network zoom handlers accept two-finger gestures, leaving one finger
for document scrolling and inspection taps. Network node dragging uses the
mouse; touch gestures on nodes follow the same scrolling/zoom behavior.

Viewport-height declarations use a `vh` fallback immediately followed by the
equivalent `dvh` value.

## Typography and motion

Font-size tokens and literal CSS font sizes use `rem`. Geometry, spacing,
border, and chart coordinate values may remain in pixels. Use the duration
tokens in `variables.css` instead of adding one-off transition durations.

Both pages honor `prefers-reduced-motion: reduce`. Because unlayered page rules
outrank layered rules, `about.css` repeats the small page-level override.

Colors derived from a design token use `color-mix()` rather than parallel RGB
channel custom properties:

```css
background: color-mix(in srgb, var(--accent) 8%, transparent);
```

## Adding styles

1. Put the rule in the file owned by the feature. Create a new kebab-case leaf
   only when ownership would otherwise be unclear.
2. Add an `@feature` comment and wrap the file in the appropriate explicit
   layer.
3. Add the direct stylesheet link to each page that needs it, after the other
   files in that layer.
4. Update the exact link arrays in `tests/styles/cascadeLayers.test.js`.
5. Run `npm run lint:css` and the raw-static smoke test.

Class names use English kebab-case with optional BEM
`__element`/`--modifier` suffixes. IDs are reserved for stable DOM contracts
consumed by JavaScript or tests.

## CSS linting

```bash
npm run lint:css
npm run lint:css:fix
```

Stylelint checks project-owned files under `src/styles/`. Vendored CSS is
excluded. CSS correctness, descending specificity, class names, and custom
property names all fail CI; the command must finish with zero warnings and zero
errors.
