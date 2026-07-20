## Summary

<!-- Describe what changed, why it changed, and any user-visible effect. -->

## Related issue

<!-- Reference the associated issue as plain #123, without a closing keyword. Use N/A only for a develop -> main promotion PR. -->

#123

## Verification

<!-- Report the command or check performed and its result. Use N/A with a reason only when a check does not apply. -->

- `npm run check`:
- Browser smoke test (`npm run dev`):
- Focused tests:
- Raw-static smoke test (`python -m http.server 8080`):

<!-- The raw-static smoke test is required for changes to imports, workers, assets, deployment, or runtime dependency loading. Otherwise, explain why it is N/A. -->

## Screenshots or recordings

<!-- Attach screenshots or recordings for UI changes. Otherwise, write N/A and explain why. -->

## Checklist

- [ ] The base branch is `develop`, or this PR promotes `develop` to `main`.
- [ ] The changes are scoped; unrelated cleanup is kept in a separate PR.
- [ ] The related issue is referenced above, or marked `N/A` only for a `develop` to `main` promotion.
- [ ] Tests were added or updated when behavior changed.
- [ ] Applicable documentation was updated, and UI text changes include all three files in `src/i18n/`.
- [ ] Generated `dist/` and `coverage/` files are not included.
