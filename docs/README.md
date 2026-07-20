# CHIVE Documentation

Use this page as the map for CHIVE's documentation. The root README is the
project overview; the sections below point to the deeper guides by reader goal.

## Use CHIVE

- [User guide](user/guide.md): load data, review tables and stats, build charts,
  use filters, compose dashboard panels, and import/export work.
- [Chart and data reference](user/chart-reference.md): pick a chart, understand
  required columns, and decode empty-state messages.
- [Privacy and security](user/privacy-security.md): browser storage, runtime
  network dependencies, trust boundaries, and current limitations.

## Deploy CHIVE

- [Static hosting](deployment/static-hosting.md): serve CHIVE as raw static
  files, configure MIME types, and run deployment smoke tests.
- [Docker deployment](deployment/docker.md): self-host CHIVE with the optional
  Nginx image and hardened security headers.
- [Vendored runtime dependencies](../vendor/README.md): runtime JavaScript,
  fonts, SQLite-WASM, and license placement.

## Contribute Code

- [Contributing](../CONTRIBUTING.md): issue flow, branch workflow, local checks,
  coding conventions, lint rules, and tests.
- [Contributor reference](development/contributor-reference.md): detailed JSDoc,
  lint guard, code placement, testing, and debugging notes.
- [Architecture overview](development/architecture.md): mental model for state,
  events, facades, rendering boundaries, and invariants.
- [Architecture reference](development/architecture-reference.md): exact state
  schema, facade methods, event registry, subscribers, persistence, and panel
  lifecycle.
- [Source map](development/source-map.md): source tree layout, naming
  vocabulary, and where new code goes.
- [Stylesheet organization](development/styles.md): CSS layers, feature
  ownership, naming conventions, and responsive breakpoints.
- [Browser support policy](development/browser-support.md): Baseline adoption,
  fallbacks, and raw-static constraints.

## Add Charts, Datasets, Or Translations

- [Chart deep dives](development/charts/README.md): code-level walkthroughs for
  every chart renderer, control surface, panel path, and test set.
- [Preset dataset guide](development/preset-datasets.md): add bundled sample
  datasets and required catalog/translation metadata.
- [Translation guide](development/i18n.md): add or update UI strings across
  supported locales.

## Maintain Documentation And Assets

- [Security policy](../SECURITY.md): supported deployments and vulnerability
  reporting channel.
- [Vendored runtime dependencies](../vendor/README.md): keep checked-in runtime
  assets, generated bundles, and license files aligned.
