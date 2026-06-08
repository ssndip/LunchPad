import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import cors from "cors";

// Modular Imports
import { logger } from "./server/logger";
import { db, initDb, seedInitialData } from "./server/db";
import { initSettings, settings, incrementMenuVersion } from "./server/config";
import { setWssInstance } from "./server/broadcast";
import { isLocalOrigin } from "./server/middleware/auth";
import { isWhitelisted } from "./server/middleware/whitelist";

// Controllers (for init/broadcast)
import { getMenu } from "./server/controllers/menuController";
import { getCards } from "./server/controllers/cardController";
import { getOrders } from "./server/controllers/orderController";
import { kioskOpen, loadKioskStatus } from "./server/controllers/statusController";
import { initAutoBackup } from "./server/controllers/backupController";

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
  // Global IP Identification
  app.set("trust proxy", 1);

  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  setWssInstance(wss);

  const PORT = process.env.PORT || 3400;

  // CORS Middleware
  app.use(cors());

  app.use(helmet({
    contentSecurityPolicy: false, // Allow Vite dev server
  }));

  const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 attempts per minute
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    skip: (req) => {
      if (process.env.NODE_ENV === 'test') return false;
      const clientIp = req.ip || "";
      return isWhitelisted(clientIp, settings.adminWhitelist);
    },
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
  
  // Init route for frontend - always public so kiosk can bootstrap
  app.get("/api/init", (req, res) => {
    res.json({
      menu: getMenu(),
      menuVersion: settings.menuVersion, // ← Critical: fix for 409 Conflict errors
      kioskOpen,
      adminWhitelistEnabled: settings.adminWhitelistEnabled,
      orderButtonEnabled: settings.orderButtonEnabled,
      testModeEnabled: settings.testModeEnabled,
      kioskModeEnabled: settings.kioskModeEnabled,
      allowPWAInstall: settings.allowPWAInstall,
      systemLanguage: settings.systemLanguage,
      bgnEnabled: settings.bgnEnabled,
      adminWhitelist: settings.adminWhitelist,
      menuDate: settings.menuDate,
      announcement: settings.announcement,
      aiProvider: settings.aiProvider,
      aiApiKey: settings.aiApiKey ? "********" : "",
      aiModel: settings.aiModel,
      aiEndpoint: settings.aiEndpoint,
      preIdentificationEnabled: settings.preIdentificationEnabled,
      kioskAutoTiming: settings.kioskAutoTiming,
      kioskOpenTime: settings.kioskOpenTime,
      kioskCloseTime: settings.kioskCloseTime,
      kioskCloseDay: settings.kioskCloseDay,
      deliveryFee: settings.deliveryFee || 0,
      packagingFee: settings.packagingFee || 0.1,
      publicAccessRequired: settings.publicAccessRequired
    });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error(`[Global Error] ${err.message}`, { stack: err.stack, path: req.path });
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: "An unexpected error occurred",
      path: req.path
    });
  });

  // --- WebSocket ---
  wss.on("connection", (ws, req) => {
    (ws as any).isAlive = true;
    const origin = req.headers.origin;
    
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
    //    - Allowed for kiosk/remote public clients
    const isAllowed = true; 

    logger.ws(`Connection attempt: origin=${origin}, local=${isLocal}, admin=${isAdmin} -> ALLOWED`);

    // All public connections are now allowed by default
    // We keep the check structure if we need to block for other reasons later.

    ws.send(JSON.stringify({
      type: "INITIAL_STATE",
      menu: getMenu(),
      orders: isAdmin ? getOrders(100) : [], 
      kioskOpen,
      cards: isAdmin ? getCards() : [],
      deliveryFee: settings.deliveryFee || 0,
      packagingFee: settings.packagingFee || 0.1,
      menuVersion: settings.menuVersion,
      adminWhitelistEnabled: settings.adminWhitelistEnabled,
      orderButtonEnabled: settings.orderButtonEnabled,
      testModeEnabled: settings.testModeEnabled,
      kioskModeEnabled: settings.kioskModeEnabled,
      allowPWAInstall: settings.allowPWAInstall,
      systemLanguage: settings.systemLanguage,
      bgnEnabled: settings.bgnEnabled,
      adminWhitelist: settings.adminWhitelist,
      menuDate: settings.menuDate,
      announcement: settings.announcement,
      aiProvider: settings.aiProvider,
      aiApiKey: settings.aiApiKey ? "********" : "",
      aiModel: settings.aiModel,
      aiEndpoint: settings.aiEndpoint,
      preIdentificationEnabled: settings.preIdentificationEnabled,
      kioskAutoTiming: settings.kioskAutoTiming,
      kioskOpenTime: settings.kioskOpenTime,
      kioskCloseTime: settings.kioskCloseTime,
      kioskCloseDay: settings.kioskCloseDay,
      publicAccessRequired: settings.publicAccessRequired
    } as any)); // Force type mapping for hydration

    ws.on("pong", () => {
      (ws as any).isAlive = true;
    });
  });

  // --- WebSocket Heartbeat (30s) ---
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
      // Also send a JSON ping for clients that don't handle binary pings easily
      ws.send(JSON.stringify({ type: "PING", ts: Date.now() }));
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  // --- Static Files & Vite ---
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    }, express.static(distPath));
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "test") {
    server.listen(Number(PORT), "0.0.0.0", () => {
      logger.info(`Server Running on http://0.0.0.0:${PORT}`);
    });
  }
  return app;
}
