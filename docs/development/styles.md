# Stylesheet Organization & Feature Ownership

This document describes the organizational structure of stylesheets and their alignment with code features.

| Field | Value |
|---|---|
| Audience | Contributors changing CSS, layout, responsive behavior, or feature styling. |
| Source of truth | CSS bundle ownership, cascade layer order, feature file map, naming conventions, and responsive breakpoints. |
| Update when | CSS files move, cascade layers change, feature ownership changes, or responsive breakpoints are added or removed. |

## Architecture

All stylesheets are imported through a bundler pattern with cascade layers:
- **Main entry**: `style.css` (declares layer order and imports feature bundles); used by `index.html`
- **Feature bundles**: `base.css`, `data-view.css`, `visual-output.css`, `controls.css`, `feedback.css`
- **Shared chrome bundle**: `chrome.css`, the foundation subset both `index.html` and `about.html` need (variables, layout, responsive, header-nav). It is loaded directly by `about.html` and transitively included in `style.css` via `base.css`.
- **Individual styles**: Feature-specific CSS files

### Cascade Layer Order

`style.css` defines this precedence from lowest to highest:

1. `foundation`
2. `controls`
3. `data-view`
4. `visual-output`
5. `feedback`

This keeps overrides intentional and avoids accidental specificity fights between bundles.

## Feature Ownership Map

### Foundation (`@feature: foundation`)
Shared infrastructure used by all features. No single feature owns these.

Foundation is split into two sub-bundles so the about page can load only what it needs:

**Shared chrome** (needed by every HTML page):

| File | Purpose |
|------|---------|
| `variables.css` | Global design tokens (colors, fonts, spacing, shadows) |
| `layout.css` | Header, logo, body padding, plus main-app workspace/sidebar (inert when those elements aren't present) |
| `responsive.css` | Header @ 900px, plus main-app responsive rules (inert when those elements aren't present) |
| `header-nav.css` | Top navigation pills and header layout, with 768px/480px reflow rules |
| `settings.css` | Header settings button and the global settings dialog (both pages share the header settings entry) |

**Bundle via**: `chrome.css` → `base.css` → `style.css` (for `index.html`) or directly via `<link>` (for `about.html`)

**App-only foundation** (only needed by the main app):

| File | Purpose |
|------|---------|
| `animations.css` | `.animate` keyframe used by app feature reveals |
| `collapsed.css` | `body.sidebar-collapsed` state styles for the main-app sidebar |

**Bundle via**: `base.css` → `style.css`

### Controls (`@feature: foundation + file-manager + results + panel`)
Generic reusable controls and sidebar card patterns.

| File | Owner | Purpose |
|------|-------|---------|
| `buttons.css` | foundation | Button styles and variants (primary, secondary, danger) |
| `upload.css` | file-manager | Upload drop zone and file upload interactions |
| `columns.css` | results | Column selection controls and filter actions |
| `visualizations.css` † | panel | Visualization card controls and preview UI |

† Owned by the Panel feature but bundled through the `controls` layer so chart controls cascade below visual output. See Panel/Visualization below.

**Bundle via**: `controls.css` → `style.css`

### Dataset Workspace/Data View (`@feature: results`)
Dataset presentation, column management, and data summaries.

| File | Purpose |
|------|---------|
| `results.css` | Dataset workspace container, empty state, file list styling |
| `table.css` | Table preview (thead, tbody, tfoot, borders, highlights) |
| `columns.css` | Column control buttons, selection UI, filter toggles |

**Bundle via**: `data-view.css` → `style.css`

### Panel/Visualization (`@feature: panel`)
Canvas layout, chart placement, and block management.

| File | Bundled via | Purpose |
|------|-------------|---------|
| `panel.css` | `visual-output.css` | Panel layout, block styling, slot borders, drag-drop |
| `charts.css` | `visual-output.css` | Chart controls, chart containers (SVG and WebGL canvas), canvas chart title/notice styles, the `.visually-hidden` a11y utility |
| `visualizations.css` † | `controls.css` | D3-specific: bar charts, scatter plots, axes, legends |

† Listed here because the Panel feature owns it, but it is imported via `controls.css` (not `visual-output.css`) so its rules cascade in the `controls` layer.

**Sub-feature**: `panel > visualizations`, visualization-specific styling

**Bundle via**: `visual-output.css` → `style.css` (except `visualizations.css`, see above)

### Cross-Cutting (`@feature: cross-cutting`)
Shared UI patterns used across multiple features.

| File | Purpose |
|------|---------|
| `messages.css` | Toast notifications, error/warning/info alerts, status displays |

`feedback.css` itself is just the bundle file (a single `@import` for `messages.css`), the same shape as `base.css`, `controls.css`, `data-view.css`, and `visual-output.css`.

**Bundle via**: `feedback.css` → `style.css`

### App Orchestration (`@feature: app`)
Main stylesheet orchestrator.

| File | Purpose |
|------|---------|
| `style.css` | Master entry point for `index.html`. Declares cascade layer order and `@import`s every feature bundle. Holds no direct rules. |

### Per-Page Stylesheets

Pages load stylesheets directly via `<link rel="stylesheet">`. `index.html` loads only `style.css`, which transitively pulls in everything. `about.html` loads `chrome.css` + `about.css` and skips the controls, data-view, visual-output, and feedback layers entirely.

| Page | Loads |
|------|-------|
| `index.html` | `style.css` (~62 KB raw, transitively) |
| `about.html` | `chrome.css` (~8 KB raw, transitively) + `about.css` (~6 KB) |

| File | Purpose | Loaded by |
|------|---------|-----------|
| `about.css` | About page hero, team grid, sidebar card, page-specific footer | `about.html` only (direct `<link>`, not via `style.css`) |

The cascade-layer system governs only the styles imported through `style.css`. Page-specific stylesheets loaded directly by an HTML page sit outside it and can override the bundled styles freely on that page. `chrome.css` declares its own `foundation` layer, so when about.html loads it alongside about.css, the same precedence (about.css overrides chrome) is preserved.

## Import Hierarchy

**index.html** loads `style.css`:

```
style.css (app)
├── base.css (foundation layer)
│   ├── chrome.css
│   │   ├── variables.css
│   │   ├── layout.css
│   │   ├── responsive.css
│   │   ├── header-nav.css
│   │   └── settings.css
│   ├── animations.css
│   └── collapsed.css
├── controls.css (controls layer)
│   ├── buttons.css (foundation)
│   ├── upload.css (file-manager)
│   ├── columns.css (results)
│   └── visualizations.css (panel)
├── data-view.css (data-view layer)
│   ├── table.css (results)
│   └── results.css (results)
├── visual-output.css (visual-output layer)
│   ├── charts.css (panel)
│   └── panel.css (panel)
└── feedback.css (feedback layer)
    └── messages.css (cross-cutting)
```

**about.html** loads `chrome.css` + `about.css` directly:

```
chrome.css (foundation layer)
├── variables.css
├── layout.css
├── responsive.css
├── header-nav.css
└── settings.css

about.css (no layer; page-specific, wins over chrome on ties)
```

## Adding New Styles

When adding styles for a new feature:

1. **Create** a new CSS file following naming convention: `featureName.css`
2. **Add** feature ownership comment at the top:
   ```css
   /* @feature: featureName
      Brief description of what this class/component styles */
   ```
3. **Organize** related styles into a bundle file (e.g., `my-bundle.css`)
4. **Import** the bundle in `style.css` in appropriate location
5. **Reference** in this document

## Class Naming Convention

Classes follow English kebab-case:
- Component prefix: `.panel-`, `.table-`, `.chart-`
- Modifiers: `.active`, `.loaded`, `.empty`, `.selected`, `.dragging`
- IDs are used sparingly for major containers

Examples:
- `.panel-block`: Panel block container
- `.table-preview`: Preview table
- `.column-actions`: Column action buttons
- `#empty-state`: Empty state container

## CSS Linting

Stylelint checks project-owned CSS under `src/styles/**/*.css`:

```bash
npm run lint:css
```

Use `npm run lint:css:fix` for safe automatic fixes. Vendored CSS, including
`vendor/fonts/fonts.css`, is intentionally ignored so checked-in third-party
assets can stay close to upstream.

The first Stylelint rollout is conservative: CSS correctness issues fail CI,
while class-name and custom-property naming conventions are warnings. Treat
warnings as cleanup signals, but do not refactor unrelated selectors only to
make a feature change pass.

## Common Variables

All colors, fonts, and scales are defined in `variables.css`.

**Colors:**

```css
--bg            /* Background */
--surface       /* Surface/card elements */
--border        /* Border color */
--accent        /* Primary brand color */
--accent-2      /* Secondary brand color */
--text          /* Text color */
--muted         /* Muted/secondary text */
--success       /* Success state */
--tag-num       /* Numeric data tag background */
--tag-txt       /* Text data tag background */
--tag-dat       /* Date data tag background */
--tag-txt-fg    /* Text data tag foreground */
--tag-dat-fg    /* Date data tag foreground */
--error         /* Error / alert family: --error, --error-light,
                   --error-bg, --error-bg-soft, --error-bg-hover,
                   --error-medium, --error-border-muted */
```

**RGB channels** (for translucent fills, e.g. `rgba(var(--accent-rgb), 0.08)`):

```css
--accent-rgb    /* 26, 71, 42  (channel form of --accent) */
--success-rgb   /* 45, 106, 79 (channel form of --success) */
--text-rgb      /* 28, 26, 23  (channel form of --text) */
```

**Fonts:**

```css
--font-display  /* Display font (IBM Plex Serif) */
--font-sans     /* UI/body font (IBM Plex Sans) */
--font-mono     /* Monospace font (JetBrains Mono) */
```

**Scales** (use these for new rules instead of raw literals; off-scale values stay inline):

```css
/* spacing (gap, padding, margin) */
--space-1: 4px;  --space-2: 6px;  --space-3: 8px;  --space-4: 10px;
--space-5: 12px; --space-6: 16px; --space-7: 20px; --space-8: 24px;

/* border radius */
--radius-sm: 3px; --radius: 5px; --radius-md: 6px;
--radius-lg: 8px; --radius-xl: 12px; --radius-pill: 999px;

/* font size (body is 14px) */
--font-size-2xs: 9px;  --font-size-xs: 10px; --font-size-sm: 11px;
--font-size-ui: 12px;  --font-size-md: 13px; --font-size-body: 14px;
--font-size-lg: 15px;

/* transition durations */
--dur-fast: 0.15s; --dur: 0.18s; --dur-slow: 0.2s; --dur-slower: 0.24s;
```

Box-shadows are intentionally **not** tokenized; their values are mostly one-offs and stay inline per component.

## Responsive Breakpoints Strategy

Responsive behavior uses `max-width` (desktop-first) media queries. The main-app layout has one canonical breakpoint at 900px in `responsive.css`, but other scopes have their own:

### Breakpoints in use

| Breakpoint | Scope | File(s) | What changes |
|------------|-------|---------|--------------|
| **1024px** | About page | [about.css:265](../../src/styles/about.css#L265) | About-page grid collapses from 2-column to 1-column; hero padding shrinks |
| **900px** | Main app layout | [responsive.css:5](../../src/styles/responsive.css#L5), [panel.css:479](../../src/styles/panel.css#L479) | Workspace stacks; header switches to column; sidebar narrows; panel block adjustments |
| **768px** | Header chrome | [header-nav.css:47](../../src/styles/header-nav.css#L47) | Header nav gap/margins shrink; header wraps |
| **640px** | About page + dataset workspace | [about.css:290](../../src/styles/about.css#L290), [results.css:356](../../src/styles/results.css#L356) | About hero compresses; team grid becomes 1-column; results-area tweaks |
| **480px** | Header chrome | [header-nav.css:58](../../src/styles/header-nav.css#L58) | Header nav reflows to full-width row below logo |

### Main-app breakpoint: 900px

**When it applies**: Screens 900px wide or less (iPads in portrait, tablets, phones)

**Layout changes**:
- **Header**: Switches from `flex` row to `column` layout; padding adjusts from `0 32px` to `18px 20px`
- **Workspace**: Changes from 2-column (`340px sidebar | 1fr main`) to single-column stacked layout
- **Sidebar**: Narrows layout when collapsed; text labels show/hide more aggressively
- **Content padding**: Reduces from `28px 32px` to `24px 20px 40px` to maximize usable space

**Component behavior**:
- When sidebar is collapsed, all text labels (`upload-text-main`, `section-title`, etc.) are forcibly shown with `display: initial !important` to prevent content hiding
- Upload zone maintains 32px padding but content font sizes adjust
- Main content area (`results-area`) gets more padding on bottom for mobile app behavior

### Design Rationale

- **Scoped breakpoints over one global breakpoint**: The main app collapses at 900px, but the about page is more text-heavy and benefits from collapsing earlier (1024px). Header chrome (nav, logo, settings button) reflows at its own thresholds because it's not feature-scoped.
- **Mobile-first semantics**: Uses `max-width` (desktop-first) but focuses UX on smaller screens first
- **Sidebar optimization**: Collapsed state becomes default visual treatment on tablets to maximize chart/table space
- **Touch-friendly spacing**: 900px breakpoint gives enough room for mouse interactions; below that prioritizes vertical real estate

### Adding New Responsive Rules

Pick the home that matches the scope of the rule:

1. **Main-app layout** (workspace, sidebar, content area) → `responsive.css` under the existing `@media (max-width: 900px)` block
2. **Feature-internal** (e.g., panel slot rearrangement, dataset workspace table) → the feature's own file (`panel.css`, `results.css`) at the breakpoint already in use there
3. **About page** → `about.css` (1024px or 640px blocks)
4. **Header chrome** (nav, logo, settings button) → `header-nav.css` (768px or 480px blocks); dialog-internal settings rules stay in `settings.css`
5. Prefer **state-based selectors** (`.sidebar-collapsed`, `.active`) over new breakpoints when the difference is interaction-driven, not viewport-driven
6. Test on: Desktop (1440px+), Tablet (768px to 900px), Mobile (375px to 480px)

### Future Breakpoint Candidates

If usability testing reveals gaps:
- **1200px**: Large desktop optimizations (wider sidebars, three-column workspace)
- **360px**: Smallest phones (single-width modals, stacked inputs)

