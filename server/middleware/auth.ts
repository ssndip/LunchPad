import express from "express";
import net from "net";
import jwt from "jsonwebtoken";
import { verifyAdminPin, settings } from "../config";
import { db } from "../db";

export const isLocalOrigin = (origin?: string): boolean => {
  if (!origin || origin === 'null') return false;
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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing Token" });
  }

  try {
    const decoded = jwt.verify(token, settings.jwtSecret) as { rfid?: string, role: string };
    (req as any).user = decoded;
    return next();
  } catch (err) {
    return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
  }
};

export const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing Token" });
  }

  try {
    const decoded = jwt.verify(token, settings.jwtSecret) as { rfid?: string, role: string };
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    (req as any).user = decoded;
    return next();
  } catch (err) {
    return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
  }
};
