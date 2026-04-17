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

export const globalAccessGuard = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const origin = req.headers.origin as string;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // 1. Always allow Local Origins (WiFi/LAN)
  if (isLocalOrigin(origin)) return next();

  // 2. Always allow Authenticated Admins
  if (token) {
    try {
      const decoded = jwt.verify(token, settings.jwtSecret) as { role: string };
      if (typeof decoded === 'object' && decoded.role === 'admin') return next();
    } catch {
      // Invalid admin token, continue to other checks
    }
  }

  // 3. If Global Access is OFF, block ALL remote traffic
  if (!settings.globalAccess) {
    console.warn(`[Security] BLOCKING remote access (Global Access OFF): ${req.path}. Origin: ${origin}`);
    return res.status(403).json({ 
      error: "Access Denied", 
      message: "Global Access is disabled. Only Local or Admin access is permitted." 
    });
  }

  // 4. If Global Access is ON, check if a Public Access Code is required
  if (settings.publicAccessCode && settings.publicAccessCode.trim() !== "") {
    // Check for session token (different from admin token)
    if (token) {
      try {
        const decoded = jwt.verify(token, settings.jwtSecret) as { role: string };
        if (typeof decoded === 'object' && decoded.role === 'public') return next();
      } catch {
        // Invalid session token, block
      }
    }
    
    // Remote client needs to "unlock" with the public code
    return res.status(401).json({ 
      error: "Authentication Required", 
      reason: "PUBLIC_ACCESS_REQUIRED",
      message: "This kiosk is secured with a Public Access Code. Please enter the code to continue." 
    });
  }

  // 5. Global Access is ON and no code is set -> Open Web Access
  return next();
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
