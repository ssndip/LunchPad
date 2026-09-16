/**
 * Mounts a single manager-dashboard tab in a phone-width iframe, so it can be
 * looked at and measured.
 *
 * Why this exists, when scripts/audit-mobile.js already builds a phone iframe:
 * __auditMobile() navigates that iframe to a URL. The dashboard tabs have no
 * URL — they are state inside ManagerDashboard, behind a PIN. AnalyticsTab is
 * the worst case: vitest cannot measure it either (recharts' ResponsiveContainer
 * reports 0x0 under happy-dom, so no chart ever lays out), which left it the one
 * surface on the mobile-polish branch that nothing had ever rendered.
 *
 * The way in is Vite's dev server: in middleware mode it transforms TSX on
 * request, so a tab component can be imported and rendered directly, with no
 * router, no dashboard shell, and no login.
 *
 * Usage:
 *   1. npm run dev                      (note the port it prints)
 *   2. Open that origin in Chrome — the SAME origin, not a different port
 *   3. Paste scripts/audit-mobile.js into the console, then this file
 *   4. await __mountTab()               // AnalyticsTab at 390px, by default
 *      __auditDocument(__tab.doc)       // the audit-mobile detectors
 *      await __tabResize(1024)          // check the desktop path still works
 *
 * Everything below is a scar. See the notes on each step.
 */
(() => {
  const PHONE_W = 390;
  const PHONE_H = 844;

  /**
   * A believable analytics payload. The shape is not invented — it mirrors
   * getAnalytics in server/controllers/orderController.ts field for field
   * (`avgOrderValue` and `uniqueCustomers`, not `avgOrder`/`uniqueUsers`;
   * topCustomers items are {rfid, name, count, total}). An earlier version of
   * this harness guessed, and `c.total.toFixed()` threw on undefined, which
   * looked exactly like "the component is broken".
   *
   * The dish names are deliberately long Bulgarian ones: they are what the
   * category-axis tick truncation exists for, and short names exercise nothing.
   */
  const ANALYTICS_FIXTURE = {
    popularMeals: [
      'Пикантни парти бутчета с гарнитура',
      'Мусака по домашному с кисело мляко',
      'Свинска пържола на скара с картофи',
      'Пиле със сметанов сос и ориз',
      'Таратор',
    ].map((name, i) => ({ name, count: 40 - i * 6 })),
    popularSides: [
      'Картофено пюре с масло и подправки',
      'Ориз с зеленчуци',
      'Салата Шопска',
      'Печени картофи',
      'Бланширан броколи',
    ].map((name, i) => ({ name, count: 33 - i * 5 })),
    peakTimes: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'].map((hour, i) => ({
      hour,
      count: [3, 9, 21, 44, 38, 12][i],
    })),
    topCustomers: [
      { rfid: 'A1B2C3D4E5', name: 'Александър Константинов-Петров', total: 412.5, count: 37 },
      { rfid: '0F9E8D7C6B', name: 'Мария Георгиева', total: 301.25, count: 29 },
      { rfid: '11223344AA', name: 'Иван Иванов', total: 188.4, count: 22 },
    ],
    timeline: Array.from({ length: 14 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      revenue: 40 + i * 13.5,
      orders: 5 + i,
    })),
    summary: { totalRevenue: 1284.75, totalOrders: 167, avgOrderValue: 7.69, uniqueCustomers: 41 },
  };

  const PRESETS = {
    analytics: {
      module: '/src/components/manager/tabs/AnalyticsTab.tsx',
      exportName: 'AnalyticsTab',
      routes: { '/api/analytics': ANALYTICS_FIXTURE },
    },
  };

  /**
   * Vite fingerprints its pre-bundled dependencies (react.js?v=c019ae68) and
   * re-hashes them whenever it re-optimizes — which it does on restart, and on
   * any dependency change. A hash copied from a previous session still 200s:
   * it serves a SECOND React instance, the component throws "Invalid hook
   * call", the body comes back empty, and an audit of that empty body reports
   * zero findings. That false all-clear is why this is derived per mount,
   * from the entry module the running server is serving right now.
   */
  async function derivePreludeUrls(origin) {
    const src = await (await fetch(`${origin}/src/main.tsx`)).text();
    const grab = (dep) => {
      const m = src.match(
        new RegExp(`["'](/node_modules/\\.vite/deps/${dep}\\.js\\?v=[^"']+)["']`)
      );
      return m && m[1];
    };
    const react = grab('react');
    const reactDom = grab('react-dom_client');
    if (!react || !reactDom) {
      throw new Error(
        'could not derive Vite dep URLs from /src/main.tsx — is the dev server running at ' +
          origin + ', and does main.tsx still import react and react-dom/client?'
      );
    }
    return { react, reactDom };
  }

  window.__mountTab = async function (opts = {}) {
    const preset = PRESETS[opts.preset || 'analytics'];
    if (!preset) throw new Error(`unknown preset: ${opts.preset}`);

    /**
     * Pinned absolute, and asserted after load. A relative src='/' resolves
     * against whatever the host tab happens to be showing, and a tab that had
     * drifted to another port once had this harness silently measuring a
     * DIFFERENT CHECKOUT of the app.
     */
    const origin = opts.origin || location.origin;
    const width = opts.width || PHONE_W;
    const { react, reactDom } = await derivePreludeUrls(origin);

    document.querySelectorAll('iframe[data-tab-harness]').forEach((n) => n.remove());
    const frame = document.createElement('iframe');
    frame.setAttribute('data-tab-harness', '');
    /**
     * content-box on purpose. Tailwind's preflight sets `box-sizing: border-box`
     * on everything, so `width: 390px` with a 2px debug border gives the frame a
     * 386px viewport — close enough to look right and wrong enough to move a
     * breakpoint or a measurement.
     */
    frame.style.cssText =
      'position:fixed;top:0;left:0;height:' + PHONE_H + 'px;border:2px solid #E11D48;' +
      'box-sizing:content-box;z-index:2147483647;background:#fff';
    frame.style.width = width + 'px';
    frame.src = origin + '/';
    document.body.appendChild(frame);

    await new Promise((resolve, reject) => {
      frame.addEventListener('load', resolve, { once: true });
      setTimeout(() => reject(new Error('iframe never loaded ' + origin)), 15000);
    });

    const w = frame.contentWindow;
    if (w.location.origin !== origin) {
      throw new Error(`origin drift: asked for ${origin}, frame is at ${w.location.origin}`);
    }

    // Surface anything the frame throws. Without this, a failed mount is
    // indistinguishable from a surface that legitimately renders nothing.
    w.__errs = [];
    w.addEventListener('error', (e) => w.__errs.push(`error: ${e.message} @ ${e.filename}`));
    w.addEventListener('unhandledrejection', (e) =>
      w.__errs.push('rejection: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason))
    );

    // Stub the API before anything mounts — the component fetches in an effect
    // that runs on its very first commit.
    const routes = Object.assign({}, preset.routes, opts.routes);
    const realFetch = w.fetch.bind(w);
    w.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const hit = Object.keys(routes).find((k) => url.indexOf(k) !== -1);
      if (hit) {
        return Promise.resolve(
          new w.Response(JSON.stringify(routes[hit]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return realFetch(input, init);
    };

    // Hide the real app rather than letting two React trees fight over the
    // page, and mount into a container that reproduces the dashboard's own
    // scroll area and padding (ManagerDashboard.tsx: `overflow-y-auto p-4 lg:p-10`).
    const doc = w.document;
    const appRoot = doc.getElementById('root');
    if (appRoot) appRoot.style.display = 'none';
    doc.getElementById('harness-out')?.remove();
    const host = doc.createElement('div');
    host.id = 'harness-out';
    host.style.cssText = 'position:fixed;inset:0;overflow-y:auto;background:#FAFAFA';
    host.innerHTML = '<div id="harness-mount" class="p-4 lg:p-10"></div>';
    doc.body.appendChild(host);

    /**
     * Injected as a <script type="module"> so the frame's own module graph
     * resolves the imports — the same graph the app uses, so the component gets
     * the app's React, not a second copy.
     *
     * The token matters: every dashboard tab guards its fetch with
     * `if (!token) return`, so without one the surface sits on its loading
     * spinner forever and reports as "renders nothing".
     */
    w.__MOUNT = null;
    const script = doc.createElement('script');
    script.type = 'module';
    script.textContent = `
import * as ReactNS from '${react}';
import * as RDC from '${reactDom}';
import { ${preset.exportName} as Tab } from '${preset.module}';
import { useStore } from '/src/store/useStore.ts';
try {
  const React = ReactNS.default || ReactNS;
  const createRoot = RDC.createRoot || (RDC.default && RDC.default.createRoot);
  useStore.setState({ token: 'harness-token' });
  createRoot(document.getElementById('harness-mount')).render(React.createElement(Tab));
  window.__MOUNT = { ok: true };
} catch (e) {
  window.__MOUNT = { ok: false, err: (e && e.stack) || String(e) };
}
`;
    doc.body.appendChild(script);

    /**
     * motion/react springs plateau mid-flight, so a "has it stopped changing?"
     * heuristic reads a value nothing will ever render at. A flat wait is less
     * clever and more correct.
     */
    await new Promise((r) => setTimeout(r, opts.settleMs ?? 3000));

    const mount = doc.getElementById('harness-mount');
    /**
     * The whole point. An empty body passes every detector in audit-mobile.js
     * with zero findings, and "0 findings" on a surface that never rendered has
     * been reported as a pass more than once in this project's history. Refuse
     * to return one.
     */
    if (!mount || !mount.innerText.trim()) {
      throw new Error(
        'nothing rendered — refusing to report a clean audit of an empty body.\n' +
          'mount result: ' + JSON.stringify(w.__MOUNT) + '\n' +
          'frame errors: ' + JSON.stringify(w.__errs)
      );
    }

    window.__tab = { frame, win: w, doc, mount, host, errs: w.__errs };
    console.log(
      `[mount-tab] ${preset.exportName} mounted at ${w.innerWidth}px — ` +
        `${mount.innerText.length} chars, ${host.scrollHeight}px tall, ` +
        `${w.__errs.length} error(s)`
    );
    if (window.__auditDocument) {
      console.log('[mount-tab] run __auditDocument(__tab.doc) for the audit-mobile detectors');
    } else {
      console.warn('[mount-tab] paste scripts/audit-mobile.js first to get __auditDocument');
    }
    return window.__tab;
  };

  /**
   * Changing the iframe's width does not reliably fire a resize event inside it,
   * and useResponsive (src/hooks/useResponsive.ts) only updates on `resize` /
   * `orientationchange` — so a width change alone leaves the component still
   * rendering its phone layout while window.innerWidth already reads 1024,
   * which reads convincingly as "the responsive layout is broken". Dispatch the
   * event by hand and give the 100ms debounce plus recharts' own observer room.
   */
  window.__tabResize = async function (width) {
    const t = window.__tab;
    if (!t) throw new Error('call __mountTab() first');
    t.frame.style.width = width + 'px';
    await new Promise((r) => setTimeout(r, 300));
    t.win.dispatchEvent(new t.win.Event('resize'));
    await new Promise((r) => setTimeout(r, 2000));
    console.log(`[mount-tab] resized to ${t.win.innerWidth}px`);
    return t.win.innerWidth;
  };

  console.log('[mount-tab] ready — call await __mountTab()');
})();
