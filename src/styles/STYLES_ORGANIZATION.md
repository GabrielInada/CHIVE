# Stylesheet Organization & Feature Ownership

This document describes the organizational structure of stylesheets and their alignment with code features.

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
| `layout.css` | Header, logo, language switcher, body padding, plus main-app workspace/sidebar (inert when those elements aren't present) |
| `responsive.css` | Header @ 900px, plus main-app responsive rules (inert when those elements aren't present) |
| `header-nav.css` | Top navigation pills and header layout, with 768px/480px reflow rules |

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

### Results/Data View (`@feature: results`)
Dataset presentation, column management, and data summaries.

| File | Purpose |
|------|---------|
| `results.css` | Results container, empty state, file list styling |
| `table.css` | Table preview (thead, tbody, tfoot, borders, highlights) |
| `columns.css` | Column control buttons, selection UI, filter toggles |

**Bundle via**: `data-view.css` → `style.css`

### Panel/Visualization (`@feature: panel`)
Canvas layout, chart placement, and block management.

| File | Bundled via | Purpose |
|------|-------------|---------|
| `panel.css` | `visual-output.css` | Panel layout, block styling, slot borders, drag-drop |
| `charts.css` | `visual-output.css` | Chart controls, D3 containers, SVG base styles |
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
│   │   └── header-nav.css
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
└── header-nav.css

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

## Common Variables

All colors, fonts, and spacing are defined in `variables.css`:

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
--font-display  /* Display font (Source Serif 4) */
--font-sans     /* UI/body font (Source Sans 3) */
--font-mono     /* Monospace font (JetBrains Mono) */
```

## Responsive Breakpoints Strategy

Responsive behavior uses `max-width` (desktop-first) media queries. The main-app layout has one canonical breakpoint at 900px in `responsive.css`, but other scopes have their own:

### Breakpoints in use

| Breakpoint | Scope | File(s) | What changes |
|------------|-------|---------|--------------|
| **1024px** | About page | [about.css:261](about.css#L261) | About-page grid collapses from 2-column to 1-column; hero padding shrinks |
| **900px** | Main app layout | [responsive.css:5](responsive.css#L5), [panel.css:489](panel.css#L489) | Workspace stacks; header switches to column; sidebar narrows; panel block adjustments |
| **768px** | Header chrome | [header-nav.css:60](header-nav.css#L60) | Header nav gap/margins shrink; header wraps |
| **640px** | About page + results | [about.css:286](about.css#L286), [results.css:292](results.css#L292) | About hero compresses; team grid becomes 1-column; results-area tweaks |
| **480px** | Header chrome | [header-nav.css:75](header-nav.css#L75) | Header nav reflows to full-width row below logo |

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

- **Scoped breakpoints over one global breakpoint**: The main app collapses at 900px, but the about page is more text-heavy and benefits from collapsing earlier (1024px). Header chrome (nav, logo, language switcher) reflows at its own thresholds because it's not feature-scoped.
- **Mobile-first semantics**: Uses `max-width` (desktop-first) but focuses UX on smaller screens first
- **Sidebar optimization**: Collapsed state becomes default visual treatment on tablets to maximize chart/table space
- **Touch-friendly spacing**: 900px breakpoint gives enough room for mouse interactions; below that prioritizes vertical real estate

### Adding New Responsive Rules

Pick the home that matches the scope of the rule:

1. **Main-app layout** (workspace, sidebar, content area) → `responsive.css` under the existing `@media (max-width: 900px)` block
2. **Feature-internal** (e.g., panel slot rearrangement, results table) → the feature's own file (`panel.css`, `results.css`) at the breakpoint already in use there
3. **About page** → `about.css` (1024px or 640px blocks)
4. **Header chrome** (nav, logo, language switcher) → `header-nav.css` (768px or 480px blocks)
5. Prefer **state-based selectors** (`.sidebar-collapsed`, `.active`) over new breakpoints when the difference is interaction-driven, not viewport-driven
6. Test on: Desktop (1440px+), Tablet (768px to 900px), Mobile (375px to 480px)

### Future Breakpoint Candidates

If usability testing reveals gaps:
- **1200px**: Large desktop optimizations (wider sidebars, three-column workspace)
- **360px**: Smallest phones (single-width modals, stacked inputs)

