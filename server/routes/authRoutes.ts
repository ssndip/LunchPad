import { Router } from "express";
import jwt from "jsonwebtoken";
import { verifyAdminPin, settings } from "../config";
import { db } from "../db";
import { adminWhitelistGuard } from "../middleware/whitelist";

const router = Router();

router.post("/login", adminWhitelistGuard, (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: "PIN is required" });
  }

  // 1. Check direct Admin PIN
  if (verifyAdminPin(String(pin))) {
    const token = jwt.sign({ role: "admin" }, settings.jwtSecret, { expiresIn: "8h" });
    return res.json({ success: true, token });
  }

  // 2. Check Admin Card RFID
  const cleanRfid = String(pin).trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
  const adminCard = db.prepare("SELECT * FROM cards WHERE LOWER(rfid) = ? AND isAdmin = 1").get(cleanRfid) as any;

  if (adminCard) {
    const token = jwt.sign({ rfid: adminCard.rfid, role: "admin" }, settings.jwtSecret, { expiresIn: "8h" });
    return res.json({ success: true, token });
  }

  res.status(401).json({ error: "Invalid PIN or Admin Card" });
});

/**
 * Public Access: Unlock with the Public Web Code
 */
router.post("/unlock", (req, res) => {
  const { code } = req.body;
  if (!settings.publicAccessCode || settings.publicAccessCode.trim() === "") {
    // If no code is required, just issue a token
    const token = jwt.sign({ role: "public" }, settings.jwtSecret, { expiresIn: "24h" });
    return res.json({ success: true, token });
  }

  if (code === settings.publicAccessCode) {
    const token = jwt.sign({ role: "public" }, settings.jwtSecret, { expiresIn: "24h" });
    return res.json({ success: true, token });
  }

  return res.status(401).json({ error: "Invalid Public Access Code" });
});

export default router;
