/**
 * Mirrors the sidebar's collapsed state from localStorage into a cookie, so the
 * server can draw the right sidebar in the placeholder frame it sends before
 * the app has loaded. Kept out of useTabs.ts because that is a client module,
 * and a server page importing a constant from it gets a reference, not a value.
 */
export const SIDEBAR_COOKIE = "sourcely.sidebar";
