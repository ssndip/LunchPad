import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";

// Modular Imports
import { db, initDb, seedInitialData } from "./server/db";
import { initSettings, globalAccessConfig, orderButtonEnabledConfig, testModeConfig } from "./server/config";
import { setWssInstance } from "./server/broadcast";
import { isLocalOrigin } from "./server/middleware/auth";

// Controllers (for init/broadcast)
import { getMenu } from "./server/controllers/menuController";
import { kioskOpen } from "./server/controllers/statusController";

// Routes
import statusRoutes from "./server/routes/statusRoutes";
import menuRoutes from "./server/routes/menuRoutes";
import cardRoutes from "./server/routes/cardRoutes";
import orderRoutes from "./server/routes/orderRoutes";
import settingsRoutes from "./server/routes/settingsRoutes";

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
  app.use(cors({
    origin: (origin, callback) => {
      if (globalAccessConfig) return callback(null, true);
      if (isLocalOrigin(origin)) return callback(null, true);
      console.warn(`[CORS] REJECTED: origin="${origin}".`);
      callback(new Error('Access Denied: Global Access is disabled.'), false);
    }
  }));

  app.use(express.json({ limit: '500kb' }));

  // --- API Routes ---
  app.get("/ping", (req, res) => res.send("pong"));

  app.use("/api/status", statusRoutes);
  app.use("/api/menu", menuRoutes);
  app.use("/api/cards", cardRoutes);
  app.use("/api/settings", settingsRoutes);
  
  // Orders & History (special case for backward compatibility of /api/v1/order)
  app.use("/api", orderRoutes); 
  // Wait, the router has /v1/order, so it should be mounted at /api. Correct.

  // Init route for frontend
  app.get("/api/init", (req, res) => {
    res.json({
      menu: getMenu(),
      kioskOpen,
      globalAccess: globalAccessConfig,
      orderButtonEnabled: orderButtonEnabledConfig,
      testModeEnabled: testModeConfig
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
    if (!globalAccessConfig && !isLocalOrigin(origin)) {
      ws.close(4003, "Access Denied");
      return;
    }
    ws.send(JSON.stringify({
      type: "INITIAL_STATE",
      menu: getMenu(),
      orders: [], 
      kioskOpen,
      cards: [] 
    }));
  });

  // --- Static Files & Vite ---
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  if (process.env.NODE_ENV !== "test") {
    server.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    });
  }
  return app;
}
