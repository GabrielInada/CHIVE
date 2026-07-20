# Browser Support Policy

CHIVE targets web platform features that are **Baseline Widely available**.
For planning purposes, that means a feature has been Baseline for roughly
30 months and is available across the current stable releases of the major
browser engines.

## Adoption rules

- Prefer standards already inside the Baseline Widely window.
- A Baseline Newly available feature may be used only when feature detection
  or an `@supports` rule preserves a complete, tested fallback.
- Do not add a runtime dependency or polyfill solely to adopt an early platform
  feature. Reassess after the feature reaches the support window.
- Recheck current Baseline data before adopting or removing a fallback. Dates in
  design notes are historical evidence, not a permanent browser matrix.
- Preserve raw-static delivery: production must continue to work when the root
  HTML, `src/`, and `vendor/` files are served directly.

The policy describes the default support posture, not a promise that every old
browser can run CHIVE. Security fixes, browser defects, and project requirements
can justify a documented exception.
