export const TABLET_NAV_VISIBLE_LIMIT = 3;

export const shouldUseTabletBurgerMenu = (navigation?: readonly unknown[] | null): boolean =>
  (navigation?.length || 0) > TABLET_NAV_VISIBLE_LIMIT;

export const getVisibleNavigationItems = <T>(navigation?: readonly T[] | null): T[] =>
  (navigation || []).slice(0, TABLET_NAV_VISIBLE_LIMIT);

export const getOverflowNavigationItems = <T>(navigation?: readonly T[] | null): T[] =>
  (navigation || []).slice(TABLET_NAV_VISIBLE_LIMIT);
