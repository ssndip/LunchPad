/**
 * Phone-layout audit for LunchPad.
 *
 * happy-dom does not lay out, so scrollWidth, clientWidth and getBoundingClientRect
 * are all zero under Vitest — geometry cannot be asserted there. CI has no browser
 * either. So this runs by hand, in a real browser, against the dev server.
 *
 * Usage:
 *   1. npm run dev
 *   2. Open http://localhost:3400 in Chrome
 *   3. Paste this whole file into the devtools console
 *   4. await __auditMobile('/')                 // kiosk
 *      await __auditMobile('/?view=manager')    // dashboard (log in inside the frame first)
 *
 * It builds a 390x840 same-origin iframe — the narrowest phone the app targets —
 * and audits inside it, so resizing or docking the real browser window is not needed.
 *
 * The dashboard tabs have no URL of their own, so __auditMobile cannot reach
 * them. Paste scripts/mount-dashboard-tab.js after this file to mount one
 * directly and audit it with __auditDocument(__tab.doc).
 */
(() => {
  const PHONE_W = 390;
  const PHONE_H = 840;
  const MIN_TARGET = 44;

  // True when `el` sits inside an ancestor that DECLARES horizontal scrolling
  // on purpose — never inferred from computed style.
  //
  // Computed overflowX cannot tell an intentional horizontal scroller from a
  // vertical-only list that a bug has made overflow sideways. Per the CSS
  // Overflow spec, when one axis is set to a non-visible value and the other
  // is left `visible`, the `visible` axis computes to `auto` instead — so a
  // plain `overflow-y: auto; width: 200px` box also reports computed
  // overflowX "auto". Measured in the live app: that vertical-only box has
  // overflowX "auto", overflowY "auto", clientWidth 185 (200 minus a 15px
  // scrollbar); after a 900px-wide child broke it sideways, scrollWidth was
  // 900 and the old computed-style check returned true — silently exempting
  // a genuine bug. Testing overflowY too does not help: an intentional
  // horizontal strip (Tailwind `overflow-x-auto`) and that broken vertical
  // list report identical computed overflowX/overflowY. So this only trusts
  // an explicit declaration — a bare `overflow-x-auto`/`overflow-x-scroll`
  // class (unprefixed, so it applies at the phone width this audit runs at;
  // a `md:overflow-x-auto` variant that isn't active at PHONE_W is
  // correctly not a match) or an inline `style.overflowX` of auto/scroll —
  // plus the existing scrollWidth > clientWidth requirement, so a declared
  // but not-actually-overflowing ancestor still exempts nothing. Walk up to
  // the document and stop there.
  function declaresHorizontalScroll(node) {
    if (node.style && (node.style.overflowX === 'auto' || node.style.overflowX === 'scroll')) {
      return true;
    }
    return node.classList.contains('overflow-x-auto') || node.classList.contains('overflow-x-scroll');
  }

  function hasScrollableAncestor(el) {
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (declaresHorizontalScroll(node) && node.scrollWidth > node.clientWidth) {
        return true;
      }
    }
    return false;
  }

  // An SVG element's `className` is an SVGAnimatedString, not a string, so
  // String(el.className) yields "[object SVGAnimatedString]". That never came
  // up while the audited surfaces were plain HTML, but the analytics tab is
  // mostly recharts <svg>, and a finding that cannot name the element it found
  // is not much of a finding.
  function className(el) {
    const c = el.className;
    if (c && typeof c === 'object' && 'baseVal' in c) return String(c.baseVal || '');
    return String(c || '');
  }

  function audit(doc) {
    const W = doc.documentElement.clientWidth;
    const findings = [];
    const add = (type, el, text, detail) =>
      findings.push({
        type,
        tag: el.tagName,
        cls: className(el).slice(0, 70),
        text: String(text || '').trim().slice(0, 40),
        detail,
      });

    for (const el of doc.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);

      // Skip truly hidden elements using two complementary tests:
      // 1. checkVisibility() catches display:none anywhere in the ancestor chain,
      //    plus content-visibility. display is NOT inherited, so checking only an
      //    element's own computed display misses everything nested inside a hidden
      //    ancestor — the exact pattern that the manager dashboard overuses.
      //    (Note: no-argument checkVisibility() does not check visibility:hidden;
      //    this script is Chrome-devtools-only and the method has shipped since Chrome 105.)
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue;
      // 2. visibility:hidden is inherited, so testing it once on the element catches
      //    the entire ancestor chain. This test is load-bearing: no-argument checkVisibility()
      //    does not cover visibility:hidden, so this line is essential, not dead code.
      if (cs.visibility === 'hidden') continue;

      // Empty label check must run before the size guard, because a t() miss
      // renders as a 0x0 <span> — that's the exact case we're trying to catch.
      const labelish = el.matches('span,h1,h2,h3,h4,label,th,td,p');
      if (labelish && !el.children.length && !el.textContent.trim() && r.width < 4) {
        add('empty-label', el, '', `width=${Math.round(r.width)}`);
        continue;
      }

      // Remaining checks need rendered size.
      if (!r.width && !r.height) continue;

      // Anything crossing the viewport edge. A horizontal body scroll on a phone
      // is always a bug; the only legitimate sideways scrollers are opt-in — an
      // element inside an ancestor that itself scrolls horizontally on purpose
      // (overflow-x: auto/scroll with real overflow, e.g. the date strip, the
      // category strip, or an admin table wrapper) is expected to extend past
      // the viewport edge, since that's what makes it reachable by scrolling.
      // Only flag elements that overflow the viewport with no such ancestor —
      // that is the real "stray horizontal body scroll" bug this check exists
      // to catch.
      if ((r.right > W + 1 || r.left < -1) && !hasScrollableAncestor(el)) {
        add('offscreen-x', el, el.textContent, `left=${Math.round(r.left)} right=${Math.round(r.right)} viewport=${W}`);
      }

      const ownsText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

      // Text wider than its own clipped box — the literal "cut-off text" case.
      if (ownsText && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) {
        add('clipped-x', el, el.textContent, `scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth}`);
      }
    }

    for (const el of doc.querySelectorAll('button,a,input,select,textarea,[role="button"]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.hasAttribute('data-audit-ignore-size')) continue;
      if (r.width < MIN_TARGET || r.height < MIN_TARGET) {
        add('small-target', el, el.innerText || el.getAttribute('aria-label'),
            `${Math.round(r.width)}x${Math.round(r.height)} < ${MIN_TARGET}`);
      }
    }

    return findings;
  }

  // Exposed so mount-dashboard-tab.js can run the same detectors against a
  // document it mounted itself. __auditMobile below builds its own iframe from
  // a URL, which only reaches surfaces a URL can reach — the dashboard tabs
  // sit behind a PIN and have no route of their own.
  window.__auditDocument = audit;

  window.__auditMobile = async function (path = '/') {
    document.querySelectorAll('iframe[data-audit-frame]').forEach((f) => f.remove());

    const frame = document.createElement('iframe');
    frame.setAttribute('data-audit-frame', '');
    frame.src = path;
    frame.width = String(PHONE_W);
    frame.height = String(PHONE_H);
    frame.style.cssText =
      'position:fixed;top:0;right:0;z-index:2147483647;border:2px solid #111;background:#fff';
    document.body.appendChild(frame);

    await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    // Let motion/react settle its enter animations before measuring; a mid-flight
    // height:auto transition reports a height nothing will ever render at.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const findings = audit(frame.contentDocument);
    const report = { path, viewport: { w: PHONE_W, h: PHONE_H }, findings };

    if (findings.length) {
      console.warn(`[audit-mobile] ${findings.length} finding(s) at ${path}`);
      console.table(findings);
    } else {
      console.log(`[audit-mobile] clean at ${path} (${PHONE_W}x${PHONE_H})`);
    }
    return report;
  };

  console.log('[audit-mobile] ready — call await __auditMobile("/")');
})();
