# Privacy And Security

This document describes CHIVE's default privacy and security model as shipped
from this repository.

## Short Summary

CHIVE is a browser-only static web application. The default deployments do not
use a CHIVE application backend, and uploaded datasets are parsed, stored, and
visualized in the browser.

That does not mean the whole page is isolated from the network. To load CHIVE,
the browser must trust the static host that serves the app and the external
origins used for runtime JavaScript modules and fonts.

## Data Processing

When you upload a CSV-like file or JSON file, CHIVE reads it through browser
file APIs and processes the content locally in the page:

- CSV/TSV/DSV-like text and JSON are parsed by CHIVE's JavaScript code.
- Data ingest runs through a browser Web Worker so larger files do not block the
  main UI thread.
- Charts are rendered in the browser using D3 and SVG/DOM.
- Dashboard panel exports are generated from the rendered SVG in the browser.

CHIVE does not upload your dataset to a CHIVE backend in the default
deployments.

## Browser Storage

CHIVE uses browser storage so work can survive refreshes:

| Storage | Name | Purpose |
|---|---|---|
| IndexedDB | `chive-state` | Datasets, selected active dataset, dashboard panel charts, layout blocks, slots, and panel counters. |
| `localStorage` | `chive.ui` | Small UI preferences such as sidebar mode and preview row count. |
| `localStorage` | `chive-locale` | Selected interface language. |

The IndexedDB schema currently uses database version `2` with these object
stores:

- `datasets`: one record per loaded dataset.
- `panel`: a singleton record for dashboard panel state.

CHIVE does not use cookies, `sessionStorage`, service workers, WebSockets, or
analytics code in the current source.

## Clearing Stored Data

Use the browser's site-data controls for the CHIVE origin you use:

1. Open the browser settings for site data or storage.
2. Search for the deployment origin, such as `apps.roberto.eti.br` or
   `gabrielinada.github.io`.
3. Delete the stored data for that origin.
4. Reload CHIVE.

Clearing storage removes persisted datasets, panel state, UI preferences, and
the saved language choice for that origin. Different deployments and local
development URLs have separate browser storage because the browser keys storage
by origin.

## External Network Dependencies

In the default static runtime, CHIVE loads these external origins:

| Origin | Used For | Notes |
|---|---|---|
| `https://esm.sh` | Browser ES modules for `d3@7.9.0` and `banana-i18n@2.4.0`. | Code from this origin executes in the CHIVE page. |
| `https://fonts.googleapis.com` | Google Fonts CSS. | Requested by `index.html` and `about.html`. |
| `https://fonts.gstatic.com` | Google Fonts font files. | Requested by the Google Fonts stylesheet. |

The stable deployment is currently documented as
`https://apps.roberto.eti.br/chive/`. The preview deployment is currently
documented as `https://gabrielinada.github.io/CHIVE/`.

Bundled preset datasets are files served with CHIVE. If you click external
source links shown for a preset, your browser navigates to that external site
separately.

## Trust Model

Using CHIVE means trusting these parts of your local environment and runtime:

- The browser and its storage implementation.
- The static host serving `index.html`, `about.html`, `src/`, and related
  assets.
- `esm.sh`, because runtime modules from that CDN execute JavaScript in the
  page.
- Google Fonts origins, because font CSS and font files are requested at page
  load.
- Browser extensions, browser policies, and device-level monitoring outside
  CHIVE's control.

If any trusted JavaScript origin is compromised or replaced by an operator, it
could read data after you load it into the page. This is why CHIVE's accurate
privacy claim is "CHIVE does not upload your dataset to a CHIVE backend", not
"your data can never leave your machine."

## Current Limitations

- Runtime module imports from `esm.sh` do not currently use Subresource
  Integrity.
- Google Fonts are loaded from external origins rather than vendored locally.
- There is no offline/vendor-local runtime dependency mode in the current
  source tree.
- The default deployments do not document a project-specific Content Security
  Policy or deployment-hardening profile.

## Recommended Use

For ordinary exploratory work, CHIVE's browser-only model keeps uploaded data
out of a CHIVE server. For sensitive or regulated datasets, use CHIVE only if
you accept the browser, static host, CDN, font, extension, and local-device
trust boundary.

For stricter environments:

- Self-host the repository from an environment you control.
- Review or vendor runtime dependencies instead of loading them from a CDN.
- Consider serving local fonts or replacing the external font dependency.
- Apply a Content Security Policy that matches your hosted dependency choices.
- Clear browser storage after use if datasets should not persist on the
  device.

## Reporting Security Concerns

For non-sensitive bugs, use the public GitHub issue templates linked from
`CONTRIBUTING.md`.

For security concerns that should not be posted publicly, contact the project
at `laoplucas@gmail.com`, the email address listed on the CHIVE About page,
first. Do not include sensitive datasets in a public issue.
