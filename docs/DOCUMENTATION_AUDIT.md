# Documentation Audit Checklist

Use this checklist whenever setup, deployment, dependency, chart, storage, or
architecture docs change.

This checklist records the source of truth used to keep CHIVE documentation in
sync with the codebase and external references. It is a maintenance aid, not an
end-user guide.

## External Checks

| Claim | Source checked | Result |
|---|---|---|
| Supported Node.js line | `https://nodejs.org/en/about/previous-releases` | Recommend an active Node.js LTS release that satisfies locked dependency engine ranges; do not hard-code a specific line unless the repo enforces it. |
| Vite engine requirement | `https://vite.dev/guide/` and `package-lock.json` | Treat the locked Vite package and install-time engine warnings as the setup source of truth. |
| Vitest engine requirement | `https://vitest.dev/guide/` and `package-lock.json` | Keep test setup docs tied to locked package metadata, not a pasted version floor. |
| Nginx official image | `https://hub.docker.com/_/nginx` and `Dockerfile` | Re-check tag, digest, and advisories before a Docker base-image bump; docs audits should flag stale pins separately from image updates. |
| Preview deployment URL | `https://gabrielinada.github.io/CHIVE/` | Verify reachability when auditing deployment docs; record failures in PR notes, not as permanent doc claims. |
| Stable deployment URL | `https://apps.roberto.eti.br/chive/` | Verify reachability when auditing deployment docs; use documented-endpoint wording unless availability is continuously monitored. |

## Claim-To-Source Checklist

| Area | Source of truth | Audit result |
|---|---|---|
| Setup commands | `package.json`, `.github/workflows/lint-and-test.yml` | README and CONTRIBUTING command lists match package scripts and CI. |
| Node/npm guidance | Node.js releases, Vite docs, `package-lock.json` | README and CONTRIBUTING point to active LTS releases and locked dependency engines instead of fixed version/date guidance. |
| Raw static deployment | `.github/workflows/deploy-pages.yml`, `Dockerfile`, `docker/default.conf` | README wording now distinguishes documented endpoints from the raw-static runtime file set. |
| Docker/CSP behavior | `docker/security-headers.conf`, README Docker section | Docker docs describe same-origin static assets and the documented CSP exceptions without claiming an eval-free profile. |
| Storage and privacy | `src/services/persistenceService/`, `src/services/persistence/`, `src/config/locale.js` | Privacy docs match IndexedDB/localStorage keys, work-only export behavior, and import limits. |
| File formats | `src/config/formats.js`, `src/services/dataService/parse.js` | README, user guide, and preset docs match CSV-like and JSON support. |
| Chart type list | `src/config/charts.js`, `src/config/chartDefaults.js`, `src/modules/panelSubsystem/renderChartFromSpec.js` | Chart docs list bar, scatter, pie, bubble, network, treemap, line, and TIN. |
| Chart options and empty states | Chart controls, render adapters, `src/i18n/en.json` | Chart docs updated for scatter linear/log scales and line missing modes. Empty-state references match i18n keys. |
| Preset datasets | `src/data/presetCatalog.js`, `src/data/presets/`, locale files | Preset guide and chart reference match bundled catalog entries and dimensions. |
| I18n | `src/config/locale.js`, `src/services/i18nService.js`, `tests/i18n.keyParity.test.js` | I18N guide matches `pt-BR` default, `en` support, `chive-locale`, and parity requirements. |
| Architecture/state events | `src/modules/state/`, `src/main.js`, `src/modules/panelManager.js` | Architecture reference updated to include `STATE_HYDRATED` as a `main.js` subscriber. |
| Stylesheet breakpoints | CSS media queries under `src/styles/` | Stylesheet organization line anchors updated to matching breakpoint locations. |
| Issue templates | `.github/ISSUE_TEMPLATE/` | Documentation template now includes `docs/USER_GUIDE.md`. |
