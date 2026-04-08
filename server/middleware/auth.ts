import express from "express";
import net from "net";
import { verifyAdminPin, globalAccessConfig } from "../config";
import { db } from "../db";

export const isLocalOrigin = (origin?: string): boolean => {
  if (!origin || origin === 'null') return true; 
  try {
    const u = new URL(origin);
    const hostname = u.hostname;
    if (hostname === 'localhost' || hostname === '[::1]') return true;
    
    if (net.isIPv4(hostname)) {
      if (hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
      if (hostname.startsWith('192.168.')) return true;
      if (hostname.startsWith('10.')) return true;
      if (hostname.startsWith('172.')) {
        const parts = hostname.split('.');
        if (parts.length >= 2) {
          const secondOctet = parseInt(parts[1], 10);
          if (secondOctet >= 16 && secondOctet <= 31) return true;
        }
      }
    }
    if (!hostname.includes('.')) return true;
  } catch (e) {
    return false;
  }
  return false;
};

export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const pin = req.headers['x-admin-pin'];
  if (!pin) {
    return res.status(401).json({ error: "Unauthorized: Missing PIN or Card" });
  }

  if (verifyAdminPin(String(pin))) {
    return next();
  }

  const cleanRfid = String(pin).trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
  const adminCard = db.prepare("SELECT * FROM cards WHERE LOWER(rfid) = ? AND isAdmin = 1").get(cleanRfid);
  
  if (adminCard) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized: Invalid PIN or Admin Card" });
};
