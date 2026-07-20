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
| `responsive.css` | Main page's 900px viewport adaptation |
| `header-nav.css` | Shared top navigation and its 768px/480px reflow |
| `settings.css` | Shared Settings entry and dialog presentation |

### Controls

| File | Owner | Purpose |
|---|---|---|
| `buttons.css` | Shared | Button variants |
| `upload.css` | Dataset workspace | Upload, file list, join, and preset controls |
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
collapse toggle is hidden.

The panel canvas is a named inline-size container. Panel templates stack at
640px of canvas width, independent of the browser viewport. JavaScript still
reads actual container width when sizing SVG or canvas backing stores.

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
