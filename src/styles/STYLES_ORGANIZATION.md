# Stylesheet Organization & Feature Ownership

This document describes the organizational structure of stylesheets and their alignment with code features.

## Architecture

All stylesheets are imported through a bundler pattern:
- **Main entry**: `style.css` (imports feature bundles)
- **Feature bundles**: `base.css`, `data-view.css`, `visual-output.css`, `controls.css`, `feedback.css`
- **Individual styles**: Feature-specific CSS files

## Feature Ownership Map

### Foundation (`@feature: foundation`)
Shared infrastructure used by all features. No single feature owns these.

| File | Purpose |
|------|---------|
| `variables.css` | Global design tokens (colors, fonts, spacing, shadows) |
| `layout.css` | Grid layout, flexbox, header, sidebar structure |
| `animations.css` | Keyframe animations, transitions, motion utilities |
| `buttons.css` | Button styles and variants (primary, secondary, danger) |
| `controls.css` | Form inputs, selects, checkboxes, toggle switches |
| `collapsed.css` | Collapsible element state and behavior |
| `responsive.css` | Media queries and responsive breakpoints |

**Bundle via**: `base.css` → `style.css`

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

| File | Purpose |
|------|---------|
| `panel.css` | Panel layout, block styling, slot borders, drag-drop |
| `charts.css` | Chart controls, D3 containers, SVG base styles |
| `visualizations.css` | D3-specific: bar charts, scatter plots, axes, legends |

**Sub-feature**: `panel > visualizations` — Visualization-specific styling

**Bundle via**: `visual-output.css` → `style.css`

### Cross-Cutting (`@feature: cross-cutting`)
Shared UI patterns used across multiple features.

| File | Purpose |
|------|---------|
| `feedback.css` | Toast notifications, status messages UI |
| `messages.css` | Error messages, warning displays, info alerts |

**Bundle via**: `feedback.css` → `style.css`

### File Management (`@feature: file-manager`)
File upload and selection UI.

| File | Purpose |
|------|---------|
| `upload.css` | Upload drop zone, file list presentation |

**Bundle via**: `controls.css` → `style.css`

### App Orchestration (`@feature: app`)
Main stylesheet orchestrator.

| File | Purpose |
|------|---------|
| `style.css` | Master entry point, composes all feature bundles |

## Import Hierarchy

```
style.css (app)
├── base.css (foundation)
│   ├── variables.css
│   ├── layout.css
│   ├── animations.css
│   ├── collapsed.css
│   └── responsive.css
├── controls.css (foundation + file-manager)
│   ├── buttons.css (foundation)
│   ├── upload.css (file-manager)
│   ├── columns.css (results)
│   └── visualizations.css (panel)
├── data-view.css (results)
│   ├── table.css (results)
│   └── results.css (results)
├── visual-output.css (panel)
│   ├── charts.css (panel)
│   └── panel.css (panel)
└── feedback.css (cross-cutting)
    └── messages.css (cross-cutting)
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

Classes follow Portuguese naming with kebab-case:
- Component prefix: `.painel-`, `.tabela-`, `.grafico-`, `.vizão-`
- Modifiers: `.ativo`, `.desativado`, `.carregado`
- IDs are used sparingly for major containers

Examples:
- `.painel-block` — Panel block container
- `.tabela-preview` — Preview table
- `.charts-controles` — Chart control UI
- `.colunas-acoes` — Column action buttons
- `#estado-vazio` — Empty state container

## Common Variables

All colors, fonts, and spacing are defined in `variables.css`:

```css
--bg           /* Background */
--surface      /* Surface/surface elements */
--border       /* Border color */
--accent       /* Primary brand color */
--accent-2     /* Secondary brand color */
--text         /* Text color */
--muted        /* Muted/secondary text */
--success      /* Success state */
--tag-num      /* Numeric data tag background */
--tag-txt      /* Text data tag background */
--tag-dat      /* Date data tag background */
--fonte-display /* Display font (Fraunces) */
--fonte-mono    /* Monospace font (IBM Plex Mono) */
```

## Responsive Breakpoints Strategy

All responsive behavior is defined in `responsive.css` with a mobile-first approach using `max-width` media queries.

### Breakpoints

| Breakpoint | Viewport | Purpose | When It Triggers |
|------------|----------|---------|------------------|
| **900px** | Tablet & smaller | Layout stacking | `@media (max-width: 900px)` |

### Breakpoint Details: 900px (Tablet/Mobile)

**When it applies**: Screens 900px wide or less (iPads in portrait, tablets, phones)

**Layout changes**:
- **Header**: Switches from `flex` row to `column` layout; padding adjusts from `0 32px` to `18px 20px`
- **Workspace**: Changes from 2-column (`340px sidebar | 1fr main`) to single-column stacked layout
- **Sidebar**: Narrows layout when collapsed; text labels show/hide more aggressively
- **Content padding**: Reduces from `28px 32px` to `24px 20px 40px` to maximize usable space
- **Header navigation**: Footer steps wrap instead of staying inline

**Component behavior**:
- When sidebar is collapsed, all text labels (`upload-texto-principal`, `secao-titulo`, etc.) are forcibly shown with `display: initial !important` to prevent content hiding
- Upload zone maintains 32px padding but content font sizes adjust
- Main content area (`area-resultados`) gets more padding on bottom for mobile app behavior

### Design Rationale

- **Single breakpoint strategy**: Simpler to maintain; most responsive patterns work for all smaller devices
- **Mobile-first semantics**: Uses `max-width` (desktop-first) but focuses UX on smaller screens first
- **Sidebar optimization**: Collapsed state becomes default visual treatment on tablets to maximize chart/table space
- **Touch-friendly spacing**: 900px breakpoint gives enough room for mouse interactions; below that prioritizes vertical real estate

### Adding New Responsive Rules

1. Add rules in `responsive.css` under the existing `@media (max-width: 900px)` block
2. Use **state-based selectors** when possible (`.sidebar-collapsed`, `.ativo`)
3. Avoid creating new breakpoints without team discussion (maintain single-breakpoint discipline)
4. Test on: Desktop (1440px+), Tablet (768px-900px), Mobile (375px-480px)

### Future Breakpoint Candidates

If the app expands or usability testing reveals gaps:
- **1200px**: Large desktop optimizations (wider sidebars, three-column layouts)
- **600px**: Small phones optimization (single-width modals, stacked inputs)

## Next Steps (Optional Improvements)

- Consider splitting `controls.css` imports to avoid loading `columns.css` and `visualizations.css` to pages that don't need them (Quando eu tiver tempo eu faço! @GabrielInada)
