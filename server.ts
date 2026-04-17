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
import { db, initDb, seedInitialData } from "./server/db";
import { initSettings, settings, incrementMenuVersion } from "./server/config";
import { setWssInstance } from "./server/broadcast";
import { isLocalOrigin, globalAccessGuard } from "./server/middleware/auth";

// Controllers (for init/broadcast)
import { getMenu } from "./server/controllers/menuController";
import { kioskOpen } from "./server/controllers/statusController";

// Routes
import statusRoutes from "./server/routes/statusRoutes";
import menuRoutes from "./server/routes/menuRoutes";
import cardRoutes from "./server/routes/cardRoutes";
import orderRoutes from "./server/routes/orderRoutes";
import settingsRoutes from "./server/routes/settingsRoutes";
import authRoutes from "./server/routes/authRoutes";
import parserRoutes from "./server/routes/parserRoutes";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB and Settings
initDb();
seedInitialData();
initSettings();

export const appPromise = startServer();

export async function startServer() {
  const app = express();
  app.set("trust proxy", true); 
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  setWssInstance(wss);

  const PORT = process.env.PORT || 3400;

  // CORS Middleware
  app.use(cors());

  // Global Access & Security Middleware
  // Apply mostly to /api, but exclude /api/auth/login so admins can actually log in to fix things!
  app.use("/api", (req, res, next) => {
    // Always allow login/unlock so admins can log in and remote users can authenticate
    // Always allow init so the kiosk can bootstrap even before authentication
    if (req.path === "/auth/login" || req.path === "/auth/unlock" || req.path === "/init") return next();
    return globalAccessGuard(req, res, next);
  });

  app.use(helmet({
    contentSecurityPolicy: false, // Allow Vite dev server
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
  });

  app.use(limiter);
  app.use(express.json({ limit: '500kb' }));

  // --- API Routes ---
  app.get("/ping", (req, res) => res.send("pong"));

  app.use("/api/status", statusRoutes);
  app.use("/api/menu", menuRoutes);
  app.use("/api/cards", cardRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/parser", parserRoutes);
  
  // Orders & History (special case for backward compatibility of /api/v1/order)
  app.use("/api", orderRoutes); 
  
  // Init route for frontend - always public so kiosk can bootstrap
  app.get("/api/init", (req, res) => {
    res.json({
      menu: getMenu(),
      menuVersion: settings.menuVersion, // ← Critical: fix for 409 Conflict errors
      kioskOpen,
      globalAccess: settings.globalAccess,
      publicAccessCode: settings.publicAccessCode ? "__REQUIRED__" : "", // Tell client a code is needed, but don't reveal it
      orderButtonEnabled: settings.orderButtonEnabled,
      testModeEnabled: settings.testModeEnabled,
      kioskModeEnabled: settings.kioskModeEnabled,
      allowPWAInstall: settings.allowPWAInstall
    });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Global Error]", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: "An unexpected error occurred",
      path: req.path
    });
  });

  // --- WebSocket ---
  wss.on("connection", (ws, req) => {
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
        if (decoded && decoded.role === "public") isPublicSession = true;
      } catch (err) {
        // Token invalid
      }
    }

    const isLocal = isLocalOrigin(origin);
    
    // Core Access Logic:
    // 1. Admin/Local ALWAYS allowed
    // 2. If Global Access is ON:
    //    - Allowed if no Public Access Code is set
    //    - Allowed if a valid Public Session Token is provided
    const isAllowed = isAdmin || isLocal || (
      settings.globalAccess && 
      (!settings.publicAccessCode || settings.publicAccessCode.trim() === "" || isPublicSession)
    );

    console.log(`[WS] Connection attempt: origin=${origin}, gAccess=${settings.globalAccess}, local=${isLocal}, admin=${isAdmin}, public=${isPublicSession} -> ${isAllowed ? 'ALLOWED' : 'REJECTED'}`);

    if (!isAllowed) {
      // Use 4001 for "Access Code Required" to distinguish from 4003 "Global Access Disabled"
      const code = (settings.globalAccess && settings.publicAccessCode) ? 4001 : 4003;
      ws.close(code, "Access Denied");
      return;
    }

    ws.send(JSON.stringify({
      type: "INITIAL_STATE",
      menu: getMenu(),
      orders: [], 
      kioskOpen,
      cards: [],
      deliveryFee: settings.deliveryFee || 0,
      packagingFee: settings.packagingFee || 0.1,
      menuVersion: settings.menuVersion,
      globalAccess: settings.globalAccess,
      publicAccessCode: settings.publicAccessCode,
      orderButtonEnabled: settings.orderButtonEnabled,
      testModeEnabled: settings.testModeEnabled,
      kioskModeEnabled: settings.kioskModeEnabled,
      allowPWAInstall: settings.allowPWAInstall
    }));

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
      console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    });
  }
  return app;
}
