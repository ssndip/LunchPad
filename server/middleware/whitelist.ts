import { Request, Response, NextFunction } from "express";
import { settings } from "../config";

/**
 * Helper to convert an IPv4 string to a 32-bit unsigned integer.
 */
function ipToLong(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Checks if a client IP or hostname matches a whitelist entry.
 * Supports exact IP, IPv4 CIDR, and Hostnames.
 */
function matchesEntry(clientIp: string, clientHostname: string, entry: string): boolean {
  entry = entry.trim();
  if (!entry) return false;

  // 1. Check exact matches (IP or Hostname)
  if (clientIp === entry || clientHostname.toLowerCase() === entry.toLowerCase()) {
    return true;
  }

  // 2. Check IPv4 CIDR
  if (entry.includes("/")) {
    const [range, maskStr] = entry.split("/");
    const mask = parseInt(maskStr, 10);
    if (isNaN(mask) || mask < 0 || mask > 32) return false;

    const clientLong = ipToLong(clientIp);
    const rangeLong = ipToLong(range);

    if (clientLong !== null && rangeLong !== null) {
      // Create mask: e.g. /24 -> 0xFFFFFF00
      // Note: 1 << 32 is 1 in JS, so handle 0 separately if needed (though /0 is rare)
      const maskBits = mask === 0 ? 0 : (0xFFFFFFFF << (32 - mask)) >>> 0;
      return (clientLong & maskBits) === (rangeLong & maskBits);
    }
  }

  return false;
}

/**
 * Main check function.
 */
export function isWhitelisted(clientIp: string, clientHostname: string, whitelistString: string): boolean {
  // Localhost is always allowed by default in this guard logic, 
  // but we also check the explicit whitelist string.
  const normalizedIp = clientIp.replace(/^::ffff:/, ""); // Handle IPv4-mapped IPv6
  
  if (normalizedIp === "127.0.0.1" || normalizedIp === "::1" || clientHostname === "localhost") {
    return true;
  }

  const entries = whitelistString.split(",");
  return entries.some(entry => matchesEntry(normalizedIp, clientHostname, entry));
}

/**
 * Middleware to restrict access to whitelisted IPs/Hostnames.
 */
export const adminWhitelistGuard = (req: Request, res: Response, next: NextFunction) => {
  // Use req.ip and req.hostname. 
  // req.ip can be IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  // 0. Skip check if whitelisting is disabled
  if (!settings.adminWhitelistEnabled) {
    return next();
  }

  const clientIp = req.ip || "";
  const clientHostname = req.hostname || "";

  if (isWhitelisted(clientIp, clientHostname, settings.adminWhitelist)) {
    console.log(`[Whitelist] Access allowed for IP: ${clientIp}, Hostname: ${clientHostname}`);
    return next();
  }

  console.warn(`[Whitelist] Blocked access from IP: ${clientIp}, Hostname: ${clientHostname}`);
  res.status(403).json({ 
    error: "Access Denied", 
    message: "Your IP address or hostname is not in the administration whitelist." 
  });
};
