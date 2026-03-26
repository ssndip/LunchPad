import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(cors());
  app.use(express.json());

  // In-memory storage for demo purposes
  let dailyMenu = [
    { id: 1, name: "Пилешка супа", description: "", price: 1.80, available: true, category: "Супи" },
    { id: 2, name: "Шкембе", description: "", price: 1.80, available: true, category: "Супи" },
    { id: 3, name: "Таратор", description: "", price: 1.50, available: true, category: "Супи" },
    { id: 4, name: "Кюфтета по чирпански", description: "", price: 2.90, available: true, category: "Основни ястия" },
    { id: 5, name: "Пилешка кавърма", description: "", price: 3.20, available: true, category: "Основни ястия" },
  ];

  let orders: any[] = [];
  let cards: any[] = [];
  let kioskOpen = true;

  // API Routes
  app.get("/api/status", (req, res) => {
    res.json({ kioskOpen });
  });

  app.post("/api/status", (req, res) => {
    kioskOpen = req.body.open;
    broadcast({ type: "STATUS_UPDATE", data: { kioskOpen } });
    res.json({ success: true, kioskOpen });
  });

  app.get("/api/menu", (req, res) => {
    res.json(dailyMenu);
  });

  app.post("/api/menu", (req, res) => {
    dailyMenu = req.body;
    // Broadcast menu update to all clients
    broadcast({ type: "MENU_UPDATE", data: dailyMenu });
    res.json({ success: true, menu: dailyMenu });
  });

  app.get("/api/orders", (req, res) => {
    res.json(orders);
  });

  app.post("/api/order", (req, res) => {
    if (!kioskOpen) {
      return res.status(403).json({ error: "Kiosk is closed" });
    }

    const { rfid, itemIds } = req.body;
    const items = dailyMenu.filter(m => itemIds.includes(m.id));
    
    if (items.length === 0) {
      return res.status(400).json({ error: "No valid items selected" });
    }

    const card = cards.find(c => c.rfid === rfid);

    if (!card) {
      return res.status(403).json({ error: "Card not registered" });
    }

    const newOrder = {
      id: Date.now(),
      rfid,
      ownerName: card.ownerName,
      items,
      timestamp: new Date().toISOString(),
      status: "pending"
    };

    orders.push(newOrder);
    
    // Broadcast new order to manager
    broadcast({ type: "NEW_ORDER", data: newOrder });
    
    res.json({ success: true, order: newOrder });
  });

  app.post("/api/orders/reset", (req, res) => {
    orders = [];
    broadcast({ type: "INITIAL_STATE", menu: dailyMenu, orders, kioskOpen, cards });
    res.json({ success: true });
  });

  app.get("/api/cards", (req, res) => {
    res.json(cards);
  });

  app.post("/api/cards", (req, res) => {
    cards = req.body;
    broadcast({ type: "CARDS_UPDATE", data: cards });
    res.json({ success: true, cards });
  });

  // WebSocket handling
  wss.on("connection", (ws) => {
    console.log("Client connected");
    ws.send(JSON.stringify({ type: "INITIAL_STATE", menu: dailyMenu, orders, kioskOpen, cards }));

    ws.on("close", () => console.log("Client disconnected"));
  });

  function broadcast(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
