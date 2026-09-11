import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import cors from "cors";

// Modular Imports
import { logger } from "./server/logger";
import { initDb, seedInitialData } from "./server/db";
import { initSettings, parseTrustProxy, settings } from "./server/config";
import { safeSend, setWssInstance } from "./server/broadcast";
import { isLocalOrigin } from "./server/middleware/auth";
import { isWhitelisted } from "./server/middleware/whitelist";

// Controllers (for init/broadcast)
import { getCards } from "./server/controllers/cardController";
import { getOrders } from "./server/controllers/orderController";
import { loadKioskStatus } from "./server/controllers/statusController";
import { initAutoBackup } from "./server/controllers/backupController";
import { buildClientState } from "./server/clientState";

// Routes
import statusRoutes from "./server/routes/statusRoutes";
import menuRoutes from "./server/routes/menuRoutes";
import cardRoutes from "./server/routes/cardRoutes";
import orderRoutes from "./server/routes/orderRoutes";
import settingsRoutes from "./server/routes/settingsRoutes";
import authRoutes from "./server/routes/authRoutes";
import parserRoutes from "./server/routes/parserRoutes";
import languageRoutes from "./server/routes/languageRoutes";
import aiRoutes from "./server/routes/aiRoutes";
import systemRoutes from "./server/routes/systemRoutes";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB and Settings
initDb();
seedInitialData();
initSettings();
loadKioskStatus();
initAutoBackup();

export const appPromise = startServer();

export async function startServer() {
  const app = express();
  // Global IP Identification. `trust proxy` decides whether X-Forwarded-For is
  // believed when deriving req.ip, which the admin whitelist and both rate
  // limiters key off — so it is opt-in via TRUST_PROXY rather than always on.
  // See parseTrustProxy in server/config.ts.
  app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  setWssInstance(wss);

  // Listen failures (port already taken, bad bind address) are emitted, not
  // thrown, so without this they surface as an uncaught exception.
  server.on("error", (err: NodeJS.ErrnoException) => {
    logger.error(`[HTTP] Server error: ${err.message}`, { code: err.code });
  });

  // Exposed so tests can drive a real socket; nothing in the app reads these.
  app.set("httpServer", server);
  app.set("wss", wss);

  const PORT = process.env.PORT || 3400;

  // CORS Middleware
  app.use(cors((req, callback) => {
    const origin = req.header('Origin');
    let corsOptions: cors.CorsOptions = { origin: false };

    if (!origin) {
      corsOptions.origin = true;
    } else {
      const host = req.header('Host');
      const forwardedHost = req.header('x-forwarded-host');
      const isLocal = isLocalOrigin(origin);

      let originHostname = '';
      try {
        originHostname = new URL(origin).hostname;
      } catch {}

      let hostHostname = '';
      try {
        hostHostname = host ? host.split(':')[0] : '';
      } catch {}

      let forwardedHostname = '';
      try {
        forwardedHostname = forwardedHost ? forwardedHost.split(':')[0] : '';
      } catch {}

      const isSameOrigin = !!(originHostname && (originHostname === hostHostname || originHostname === forwardedHostname));

      if (settings.globalAccess || isLocal || isSameOrigin) {
        corsOptions.origin = true;
      }
    }

    callback(null, corsOptions);
  }));

  // A Content-Security-Policy is the difference between an injected string
  // becoming script and it staying text. It was switched off outright with the
  // note "Allow Vite dev server" — true of dev, but the flag was not gated on
  // the environment, so production shipped with no CSP either.
  //
  // `useDefaults: false` is deliberate: helmet's default set includes
  // `upgrade-insecure-requests`, which would rewrite every request on a kiosk
  // reaching the server over plain http on a LAN address (http://192.168.x.x:
  // 3400 — the normal deployment) to https and break the whole page.
  //
  // The app loads nothing from another origin: no CDN, no Google Fonts, no
  // remote images. So everything is 'self', with three narrow exceptions noted
  // below. In development this is off, because Vite's middleware serves inline
  // scripts and an HMR websocket on another port.
  const isProduction = process.env.NODE_ENV === "production";

  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        // No inline script on the page: the PWA plugin's registration is an
        // external /registerSW.js. See index.html.
        scriptSrc: ["'self'"],
        // React and motion inject <style> elements at runtime.
        styleSrc: ["'self'", "'unsafe-inline'"],
        // data:/blob: cover the icons and the report and backup downloads the
        // dashboard builds in the browser.
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "data:"],
        // 'self' alone does not reliably cover ws:// in every browser, and the
        // kiosk's live connection is the app's spine — losing it is a silent
        // failure at the till. It is same-origin in practice (useWebSocket
        // builds the URL from window.location.host).
        connectSrc: ["'self'", "ws:", "wss:"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      }
    } : false,
  }));

  // Deliberately has no `skip`. It used to exempt whitelisted IPs, which made
  // it inert: adminWhitelistGuard answers this same route against the same
  // list, so every caller able to attempt a PIN was also exempt from the limit,
  // and the only requests it ever throttled were ones already being refused
  // with 403. A 4-6 digit admin PIN could therefore be guessed at full speed
  // from any machine on the canteen LAN — exactly the caller this is meant to
  // slow down. 10/minute is far above what a person typing a PIN needs.
  const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 attempts per minute
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: "Too many login attempts", message: "Please try again in a minute" },
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit hit: Auth endpoint from IP ${req.ip}`);
      res.status(options.statusCode).json(options.message);
    }
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 100 : 5000, // Reduced for tests, 5000 for production headroom
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    skip: (req) => {
      // EXEMPT critical endpoints from the general rate limit
      const exemptPaths = ["/auth/login", "/auth/unlock", "/init", "/ping"];
      if (exemptPaths.some(p => req.path === p)) return true;

      // EXEMPT whitelisted local/admin IPs
      if (process.env.NODE_ENV === 'test') return false;
      const clientIp = req.ip || "";
      return isWhitelisted(clientIp, settings.adminWhitelist);
    },
    message: { error: "Too many requests", message: "Please try again later" },
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit hit: API endpoint ${req.path} from IP ${req.ip}`);
      res.status(options.statusCode).json(options.message);
    }
  });

  // Apply General API Limiter to all /api routes (with its own skip logic for critical paths)
  app.use("/api", apiLimiter);

  // Apply Auth Limiter specifically to login/unlock (separate quota)
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/unlock", authLimiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // --- API Routes ---
  app.get("/ping", (req, res) => res.send("pong"));

  app.use("/api/status", statusRoutes);
  app.use("/api/menu", menuRoutes);
  app.use("/api/cards", cardRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/parser", parserRoutes);
  app.use("/api/languages", languageRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/system", systemRoutes);
  
  // Orders & History (special case for backward compatibility of /api/v1/order)
  app.use("/api", orderRoutes); 
  
  // Init route for frontend - always public so kiosk can bootstrap.
  // Unauthenticated, so it never carries admin-only fields (see buildClientState).
  app.get("/api/init", (req, res) => {
    res.json(buildClientState({ isAdmin: false }));
  });

  // Unknown API paths must not reach the SPA fallback below. `app.get("*")`
  // answers every unmatched path with index.html, so a typo'd or removed
  // endpoint came back as 200 text/html — `res.ok` was true and the caller then
  // threw parsing a page of HTML as JSON, which reads as a client bug rather
  // than the missing route it is.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not Found", message: `No API route for ${req.method} ${req.originalUrl}` });
  });

  // --- WebSocket ---
  // A `ws` socket with no 'error' listener rethrows, which ends the process.
  // Every accepted socket gets one below; this covers failures raised on the
  // server itself (a botched upgrade, an EADDR problem) before that point.
  wss.on("error", (err) => {
    logger.error(`[WS] Server error: ${err.message}`, { stack: err.stack });
  });

  wss.on("connection", (ws, req) => {
    (ws as any).isAlive = true;
    const origin = req.headers.origin;

    // Registered first, so it is in place for anything that follows. Abrupt
    // client disconnects (a tablet sleeping, wifi dropping) surface here as
    // ECONNRESET and must stay contained to this one socket.
    ws.on("error", (err) => {
      logger.ws(`Socket error, dropping client: ${err.message}`);
      try { ws.terminate(); } catch { /* already gone */ }
    });
    
    // Extract token from query string (e.g. ws://host?token=xxx)
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const token = url.searchParams.get("token");
    
    let isAdmin = false;
    let isPublicSession = false;

    if (token) {
      try {
        const decoded = jwt.verify(token, settings.jwtSecret) as any;
        if (decoded && decoded.role === "admin") isAdmin = true;
      } catch (err) {
        // Token invalid
      }
    }

    const isLocal = isLocalOrigin(origin);
    
    // 1. Determine if connection is allowed:
    //    - Always allowed for Admin dashboard
    //    - Always allowed for Local Origins (WiFi/LAN)
    //    - Allowed for kiosk/remote public clients if globalAccess is enabled
    const isAllowed = isAdmin || settings.globalAccess || isLocal; 

    if (!isAllowed) {
      logger.ws(`Connection attempt blocked: origin=${origin}, globalAccess=${settings.globalAccess}, local=${isLocal}, admin=${isAdmin}`);
      ws.close(4003, "Access Denied: Global Access is disabled.");
      return;
    }

    logger.ws(`Connection attempt: origin=${origin}, local=${isLocal}, admin=${isAdmin} -> ALLOWED`);

    // Tag the socket so admin-only broadcasts (e.g. the AI key) can target it.
    (ws as any).isAdmin = isAdmin;

    safeSend(ws, JSON.stringify({
      type: "INITIAL_STATE",
      ...buildClientState({ isAdmin }),
      orders: isAdmin ? getOrders(100) : [],
      cards: isAdmin ? getCards() : [],
    } as any)); // Force type mapping for hydration

    ws.on("pong", () => {
      (ws as any).isAlive = true;
    });
  });

  // --- WebSocket Heartbeat (30s) ---
  const interval = setInterval(() => {
    const ping = JSON.stringify({ type: "PING", ts: Date.now() });
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (err: any) {
        logger.ws(`Ping failed, dropping client: ${err?.message || err}`);
        ws.terminate();
        return;
      }
      // Also send a JSON ping for clients that don't handle binary pings easily
      safeSend(ws, ping);
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  // --- Static Files & Vite ---
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    // Imported lazily so `vite` stays a devDependency and never ships in the
    // production image (this branch is unreachable when NODE_ENV=production).
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");

    // Everything under dist used to be served `no-store`, which meant a kiosk
    // re-downloaded the entire ~2MB bundle on every cold load — over canteen
    // wifi, on a tablet, before anyone can order. Vite fingerprints the files
    // in /assets (index-DD638HiL.js), so their contents can never change under
    // a given name and they are safe to cache for good.
    //
    // index.html, the service worker and the manifest are the opposite case:
    // they keep their names across builds and are how a new release is picked
    // up at all, so they must never be served from a stale cache.
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        const isFingerprinted = filePath.startsWith(path.join(distPath, "assets") + path.sep);
        if (isFingerprinted) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));

    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler.
  // Registered last, after the API routes AND the static/SPA handlers, because
  // Express only routes an error to handlers declared after the middleware that
  // threw it. Previously it sat above the static and Vite middleware, so errors
  // raised there fell through to Express's default handler instead.
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error(`[Global Error] ${err.message}`, { stack: err.stack, path: req.path });
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: "An unexpected error occurred",
      path: req.path
    });
  });

  if (process.env.NODE_ENV !== "test") {
    server.listen(Number(PORT), "0.0.0.0", () => {
      logger.info(`Server Running on http://0.0.0.0:${PORT}`);
    });
  }
  return app;
}
