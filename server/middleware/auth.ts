import express from "express";
import net from "net";
import jwt from "jsonwebtoken";
import { verifyAdminPin, settings } from "../config";
import { isWhitelisted } from "./whitelist";
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
    // A single-label hostname is a LAN machine name ("kiosk-tablet",
    // "lunchpad"), which is legitimate here — but only when it is not an IP
    // literal that failed the checks above, and never for a bare public name.
    if (!hostname.includes('.') && !net.isIP(hostname) && !hostname.includes(':')) return true;
  } catch (e) {
    return false;
  }
  return false;
};



/**
 * Address ranges a kiosk can legitimately sit on. Deliberately a fixed list
 * rather than `settings.adminWhitelist`, which an admin may have widened to
 * include public addresses so they can reach the dashboard from off-site.
 */
const PRIVATE_RANGES = "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8";

export const isPrivateAddress = (ip?: string): boolean => {
  if (!ip) return false;
  const normalized = ip.replace(/^::ffff:/, "");
  if (normalized === "::1") return true;
  return isWhitelisted(normalized, PRIVATE_RANGES);
};

/**
 * Guard for the kiosk endpoints that expose cardholder data — the active RFID
 * list and the per-card profile. A kiosk holds no credentials, so these carried
 * no auth at all, which let anyone who could reach the server enumerate every
 * RFID and then read each holder's name, balance and order history (and an RFID
 * on its own is enough to place an order against that account).
 *
 * Any valid token passes. Otherwise the caller must be on the local network,
 * where the kiosks live. A kiosk reaching the server across the public internet
 * therefore needs a token from /api/auth/unlock.
 */
export const requireLocalOrAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      jwt.verify(token, settings.jwtSecret);
      return next();
    } catch (err) {
      // Fall through to the network check — an expired kiosk token on the LAN
      // should not lock the kiosk out of its own card list.
    }
  }

  if (isPrivateAddress(req.ip)) return next();

  return res.status(401).json({
    error: "Unauthorized",
    message: "Card data is restricted to the local network or authenticated clients."
  });
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
