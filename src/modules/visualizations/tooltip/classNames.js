/**
 * Shared CSS class names for the chart tooltip.
 *
 * Single source of truth for the `chart-tooltip*` classes used by both the
 * overlay core (`tooltip.js`, e.g. the pin class and the focus-trap selector)
 * and the DOM builders (`tooltip/content.js`). Keeping them here stops the two
 * sides from drifting: the focus trap queries `button.${ACTION_CLASS}` /
 * `button.${CLOSE_CLASS}`, so those must match the classes the builders set.
 *
 * Dynamic modifier suffixes (`--${state}`, `--${variant}`) are not standalone
 * classes and stay inline at their call sites.
 *
 * @see src/styles/charts.css for the matching rules.
 */

/** Base tooltip element class. */
export const BASE_CLASS = 'chart-tooltip';

/** Applied while the tooltip is pinned. */
export const PINNED_CLASS = 'chart-tooltip--fixado';

/** Action button class (base; danger/primary append a `--${variant}` modifier). */
export const ACTION_CLASS = 'chart-tooltip__action';

/** Wrapper around a row of action buttons. */
export const ACTIONS_CLASS = 'chart-tooltip__actions';

/** Pinned-shell header row. */
export const HEADER_CLASS = 'chart-tooltip__header';

/** Pinned-shell header title text. */
export const HEADER_TITLE_CLASS = 'chart-tooltip__header-title';

/** Pinned-shell close button. */
export const CLOSE_CLASS = 'chart-tooltip__close';

/** Divider between the body and the action groups. */
export const DIVIDER_CLASS = 'chart-tooltip__divider';

/** Filter-state badge (base; included/excluded append a `--${state}` modifier). */
export const STATE_BADGE_CLASS = 'chart-tooltip__filter-state';

/** Icon span inside the filter-state badge. */
export const STATE_BADGE_ICON_CLASS = 'chart-tooltip__filter-state-icon';

/** Labeled action-set group. */
export const ACTION_GROUP_CLASS = 'chart-tooltip__action-set';

/** Wrapper around a labeled action-set group. */
export const ACTION_GROUP_WRAP_CLASS = 'chart-tooltip__action-set-wrap';

/** Heading label above a labeled action-set group. */
export const ACTION_GROUP_LABEL_CLASS = 'chart-tooltip__action-set-label';
