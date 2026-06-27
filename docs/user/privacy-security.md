# Privacy And Security

This document describes CHIVE's default privacy and security model as shipped
from this repository.

## Short Summary

CHIVE is a browser-only static web application. The default deployments do not
use a CHIVE application backend, and uploaded datasets are parsed, stored, and
visualized in the browser.

That does not mean the whole page is isolated from the network. To load CHIVE,
the browser must trust the static host that serves the app. Runtime JavaScript
dependencies and fonts are vendored and served from the same static host.

## Data Processing

When you upload a CSV-like file or JSON file, CHIVE reads it through browser
file APIs and processes the content locally in the page:

- CSV/TSV/DSV-like text and JSON are parsed by CHIVE's JavaScript code.
- Data ingest runs through a browser Web Worker so larger files do not block the
  main UI thread.
- Project auto-save also runs through a browser Web Worker, so writing the SQLite
  byte image to IndexedDB does not block the main UI thread. This adds no new
  network origin: the worker and its vendored SQLite-WASM are same-origin assets
  served with CHIVE.
- Charts are rendered in the browser using D3 and SVG/DOM.
- Dashboard panel exports are generated from the rendered SVG in the browser.

CHIVE does not upload your dataset to a CHIVE backend in the default
deployments.

## Browser Storage

CHIVE uses browser storage so auto-saved work can survive refreshes:

| Storage | Name | Purpose |
|---|---|---|
| IndexedDB | `chive-sqlite` | A single SQLite database byte image at store `db`, key `project`. Contains datasets, selected active dataset id, dashboard panel charts, layout blocks, slots, and panel counters. |
| `localStorage` | `chive.ui` | Small UI preferences such as sidebar mode and preview row count. |
| `localStorage` | `chive-locale` | Selected interface language. |
| `localStorage` | `chive.migrated` | One-time migration tombstone that prevents old raw IndexedDB data from being re-imported after a clear. |

The SQLite project schema separates lightweight work metadata from heavy row
payloads:

- `datasets`: dataset metadata/config, selected columns, precomputed stats, and a deterministic fingerprint.
- `app_state`: active dataset id and panel state without row payloads.
- `dataset_payload`: dataset rows as JSON.
- `panel_snapshot_payload`: saved chart snapshot rows and columns.

Project changes auto-save: a debounced save writes the SQLite byte image to
IndexedDB a couple of seconds after the last edit, and CHIVE attempts a
best-effort lifecycle save when the page hides, freezes, or closes. Hard
crashes or interrupted closes can still lose changes made since the last
successful save.

Project export downloads a `.chive.sqlite3` file from the browser. Full exports
contain dataset rows and saved chart snapshot payloads. Work-only exports omit
the row contents of `dataset_payload` and `panel_snapshot_payload`, but still
contain dataset names, column metadata, chart configuration, panel layout, and
deterministic dataset fingerprints. Project import currently accepts only full
exports and replaces the current datasets and panel after confirmation.

Existing installs with the old raw IndexedDB database `chive-state` are imported
once when no SQLite project exists. After a successful import or an empty legacy
check, `chive.migrated` is set so old data is not resurrected later.

CHIVE does not currently use cookies, `sessionStorage`, service workers, WebSockets, or
analytics code.

## Clearing Stored Data

Use the browser's site-data controls for the CHIVE origin you use:

1. Open the browser settings for site data or storage.
2. Search for the deployment origin, such as `apps.roberto.eti.br` or
   `gabrielinada.github.io`.
3. Delete the stored data for that origin.
4. Reload CHIVE.

Clearing browser site data removes persisted datasets, panel state, UI
preferences, and the saved language choice for that origin. Different
deployments and local development URLs have separate browser storage because
the browser keys storage by origin.

CHIVE's in-app clear path removes the SQLite project, the old `chive-state`
database, and `chive.ui`, then sets the `chive.migrated` tombstone. It does not
remove `chive-locale`.

## External Network Dependencies

In the default static runtime, CHIVE does not load external origins during page
startup.

D3, banana-i18n, SQLite-WASM, and fonts are served as same-origin vendored files
from `vendor/`.

The documented stable endpoint is `https://apps.roberto.eti.br/chive/`.
The documented preview endpoint is `https://gabrielinada.github.io/CHIVE/`.
Deployment availability is operational, but neither endpoint requires CHIVE to
send uploaded datasets to a CHIVE application backend.

Bundled preset datasets are files served with CHIVE. If you click external
source links shown for a preset, your browser navigates to that external site
separately.

## Docker Deployment (Optional)

The optional Docker image (see the README) serves every runtime asset from a
single origin and adds a hardened Nginx config: conservative security headers and
an enforcing local-only Content Security Policy. The CSP keeps a documented
`'unsafe-eval'` exception because D3's CSV parser requires it, so the image is
more locked down than a plain static host but is not a fully hardened, eval-free
profile. It does not change the trust model below, and these properties apply to
the Docker image only, not to the default non-Docker deployments.

## Trust Model

Using CHIVE means trusting these parts of your local environment and runtime:

- The browser and its storage implementation.
- The static host serving `index.html`, `about.html`, `src/`, `vendor/`, and related
  assets, including vendored runtime JavaScript and fonts.
- Browser extensions, browser policies, and device-level monitoring outside
  CHIVE's control.

If any trusted JavaScript origin is compromised or replaced by an operator, it
could read data after you load it into the page. This is why CHIVE's accurate
privacy claim is "CHIVE does not upload your dataset to a CHIVE backend", not
"your data can never leave your machine."

## Current Limitations

- Runtime JavaScript dependencies and fonts are vendored locally, but deployment
  hardening still depends on the chosen static host and browser policy.
- The default deployments do not document a project-specific Content Security
  Policy or deployment-hardening profile.

## Recommended Use

For ordinary exploratory work, CHIVE's browser-only model keeps uploaded data
out of a CHIVE server. For sensitive or regulated datasets, use CHIVE only if
you accept the browser, static host, extension, and local-device trust boundary.

For stricter environments:

- Self-host the repository from an environment you control.
- Review vendored runtime dependencies before deployment.
- Apply a Content Security Policy that matches your hosted dependency choices.
  Because data ingest and project saves run in Web Workers, and the saves use
  vendored SQLite-WASM, a strict policy must permit them from the same origin,
  for example `worker-src 'self'` plus same-origin WASM fetch/compile (which,
  depending on the final policy, may also require `script-src 'wasm-unsafe-eval'`).
  These are necessary for the worker/SQLite path but are not necessarily the only
  directives a hardened deployment needs.
- Clear browser storage after use if datasets should not persist on the
  device.

## Reporting Security Concerns

For non-sensitive bugs, use the public GitHub issue templates linked from
`CONTRIBUTING.md`.

For security concerns that should not be posted publicly, contact the project
at `laoplucas@gmail.com`, the email address listed on the CHIVE About page,
first. Do not include sensitive datasets in a public issue.
