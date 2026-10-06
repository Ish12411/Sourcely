/**
 * Safe-area insets for the Natively iOS app, run inline in <head> before the
 * first paint.
 *
 * Inside Natively's web view, env(safe-area-inset-*) reads as zero even with
 * viewport-fit=cover, while the page is still drawn under the status bar and
 * home indicator. A screen recording from a real iPhone showed the result: the
 * header's ☰ button sat under the clock (so the sidebar could not be opened),
 * Share and Sources overlapped the battery, and the sources sheet's ✕ was
 * unreachable. Everything in globals.css pads by --safe-top/bottom/left/right,
 * so this fills those in when, and only when, the real values are missing:
 *
 * 1. Only in Natively on iOS. Safari and every other browser are untouched.
 * 2. Only if WebKit's own env() values are all zero. If a later Natively build
 *    reports them properly, those win and this does nothing.
 * 3. If Natively's own "Safe Area" setting has already moved the web view
 *    below the status bar (the view is shorter than the screen), the top is
 *    left at zero so it is not padded twice.
 *
 * iOS doesn't expose the inset sizes to a web view any other way, so they come
 * from the screen size, in points: Dynamic Island iPhones are 852pt tall or
 * more, notched ones 812–851pt, and earlier models with a home button shorter.
 * Being a few points generous is harmless; every padding here already has its
 * own margin on top.
 */
export const NATIVE_INSETS_SCRIPT = `(function () {
  try {
    // indexOf, not a regex: this lives in a template string, where a
    // backslash-escaped slash silently loses its backslash.
    if (navigator.userAgent.indexOf("Natively/iOS") === -1) return;
    var root = document.documentElement;
    root.classList.add("natively");

    var probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    root.appendChild(probe);
    var cs = getComputedStyle(probe);
    var reported = parseFloat(cs.paddingTop) + parseFloat(cs.paddingRight) +
      parseFloat(cs.paddingBottom) + parseFloat(cs.paddingLeft);
    root.removeChild(probe);
    if (reported > 0) return;

    var long = Math.max(screen.width, screen.height);
    var ipad = long >= 1000;
    var island = !ipad && long >= 852;
    var notch = !ipad && !island && long >= 812;
    var faceId = island || notch;

    // Measured once in portrait, before any keyboard can shrink the view:
    // how much shorter the web view is than the screen.
    var portraitGap = null;

    function apply() {
      var landscape = window.innerWidth > window.innerHeight;
      var top = 0, bottom = 0, side = 0;
      if (ipad) {
        top = 24; bottom = 20;
      } else if (landscape) {
        side = island ? 59 : notch ? 47 : 0;
        bottom = faceId ? 21 : 0;
      } else {
        top = island ? 59 : notch ? 47 : 20;
        bottom = faceId ? 34 : 0;
      }
      if (!landscape && portraitGap === null) portraitGap = long - window.innerHeight;
      if (portraitGap !== null && portraitGap >= 15) {
        // Natively's Safe Area setting already keeps the view clear of the top.
        top = 0;
        if (portraitGap >= 40 + bottom) bottom = 0;
      }
      if (landscape && long - window.innerWidth >= side) side = 0;

      root.style.setProperty("--safe-top", top + "px");
      root.style.setProperty("--safe-bottom", bottom + "px");
      root.style.setProperty("--safe-left", side + "px");
      root.style.setProperty("--safe-right", side + "px");
    }

    apply();
    // Recalculate on rotation only, detected as a change of width. The
    // keyboard opening also fires resize but only changes the height, and
    // recalculating then would yank the header down mid-typing.
    var lastWidth = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      apply();
    });
  } catch (e) {}
})();`;
