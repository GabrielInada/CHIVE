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
| SQLite-WASM | See `vendor/sqlite/` | `vendor/sqlite/` | See upstream files in that directory |

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

`vendor/fonts/fonts.css` is the runtime font entrypoint. Keep it limited to the
font files CHIVE actually uses so browsers do not download unnecessary faces.

## Inlined Icon Assets

The settings (gear) icon in the shared page header of `index.html` and
`about.html` is the "settings" icon from [Lucide](https://lucide.dev), inlined
as SVG markup so it can inherit the header text color via `currentColor` and
load with no external requests. Lucide is licensed under the ISC License
(https://github.com/lucide-icons/lucide/blob/main/LICENSE). Follow the same
offline model for any new icon: inline it or check it into `src/icons/`, and
record its source and license here.
