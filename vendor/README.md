# Vendored Runtime Dependencies

CHIVE's default static runtime loads browser JavaScript dependencies from this
directory instead of external JavaScript CDNs.

| Package | Version | Runtime file | License |
|---|---:|---|---|
| D3 | 7.9.0 | `vendor/d3/d3.js` | `vendor/d3/LICENSE` |
| banana-i18n | 2.4.0 | `vendor/banana-i18n/banana-i18n.js` | `vendor/banana-i18n/LICENSE` |
| SQLite-WASM | See `vendor/sqlite/` | `vendor/sqlite/` | See upstream files in that directory |

The D3 and banana-i18n files are ESM bundles generated from the npm packages
locked in `package-lock.json`. If either package version changes, regenerate
the matching bundle from the installed dependency, commit the generated file,
and keep the upstream license file with it.
