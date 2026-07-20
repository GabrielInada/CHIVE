# Vendored Runtime Dependencies

CHIVE's default static runtime loads browser JavaScript dependencies from this
directory instead of external JavaScript CDNs.

| Package | Version | Runtime file | License |
|---|---:|---|---|
| D3 | 7.9.0 | `vendor/d3/d3.js` | `vendor/d3/LICENSE` |
| banana-i18n | 2.4.0 | `vendor/banana-i18n/banana-i18n.js` | `vendor/banana-i18n/LICENSE` |
| Three.js | 0.185.1 | `vendor/three/three.module.js` (+ `three.core.js`) | `vendor/three/LICENSE` |
| IBM Plex Serif | See font metadata | `vendor/fonts/ibm-plex-serif/` | `vendor/fonts/ibm-plex-serif/OFL.txt` |
| IBM Plex Sans | See font metadata | `vendor/fonts/ibm-plex-sans/` | `vendor/fonts/ibm-plex-sans/OFL.txt` |
| JetBrains Mono | See font metadata | `vendor/fonts/jetbrains-mono/` | `vendor/fonts/jetbrains-mono/OFL.txt` |
| SQLite-WASM | 3.53.0-build1 | `vendor/sqlite/` (`sqlite3.js`, `sqlite3.wasm`, worker and OPFS companion files) | Upstream package metadata: Apache-2.0; generated files also retain SQLite/Emscripten notices in their headers |

The D3 and banana-i18n files are ESM bundles generated from the npm packages
locked in `package-lock.json`. If either package version changes, regenerate
the matching bundle from the installed dependency, commit the generated file,
and keep the upstream license file with it.

The Three.js files are the upstream ESM build copied as-is from the npm
package locked in `package-lock.json` (`node_modules/three/build/`).
`three.module.js` is the import entrypoint; it imports `./three.core.js`
via a relative path, so both files must move together. On a version bump,
re-copy both files, keep the provenance header lines, and update the
version here and in the headers.

The SQLite-WASM JavaScript files are single-file bundles generated from the
`@sqlite.org/sqlite-wasm` package locked in `package-lock.json`; they are not
copied as-is from its `dist/` directory, which exposes the API as `index.mjs`
plus separate companion modules. Only `sqlite3.wasm` is a verbatim npm-package
copy. Regeneration requires a bundler, and all four runtime, worker, WASM, and
OPFS files must be replaced as one compatible set. Retain their upstream
notices and update the version recorded here.

`vendor/fonts/fonts.css` is the runtime font entrypoint. Keep it limited to the
font files CHIVE actually uses so browsers do not download unnecessary faces.

## Verification

Run `npm run verify:vendor` to compare the checked-in runtime files against
`package-lock.json`, reproducible files under `node_modules/`, companion-file
and license requirements, and the font URLs. CI enforces the same checks
through `tests/scripts/vendor-checks.test.js`.

For Three.js updates, `node scripts/sync-vendor.mjs three` copies both upstream
ESM files and adds their provenance headers. Other targets print guided
regeneration steps because their checked-in JavaScript is bundled rather than
copied directly from npm dist files.

## Inlined Icon Assets

The settings (gear) icon in the shared page header of `index.html` and
`about.html` is the "settings" icon from [Lucide](https://lucide.dev), inlined
as SVG markup so it can inherit the header text color via `currentColor` and
load with no external requests. Lucide is licensed under the ISC License
(https://github.com/lucide-icons/lucide/blob/main/LICENSE). Follow the same
offline model for any new icon: inline it or check it into `src/icons/`, and
record its source and license here.
