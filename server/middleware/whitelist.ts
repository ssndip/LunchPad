import { Request, Response, NextFunction } from "express";
import net from "net";
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
 * Expands an IPv6 address to its 16 bytes, or null if it is not one.
 *
 * Handles the `::` run-length compression and a trailing IPv4 form
 * (`::ffff:192.168.1.5`). A `%eth0` zone index is stripped first.
 */
function ipv6ToBytes(ip: string): Uint8Array | null {
  const address = ip.toLowerCase().split("%")[0];
  if (!net.isIPv6(address)) return null;

  const [head, tail] = address.split("::");
  const parseGroups = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    for (const group of part.split(":")) {
      if (group.includes(".")) {
        // A trailing dotted-quad occupies the last two hextets.
        const long = ipToLong(group);
        if (long === null) return null;
        out.push((long >>> 16) & 0xffff, long & 0xffff);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      out.push(parseInt(group, 16));
    }
    return out;
  };

  const left = parseGroups(head ?? "");
  const right = tail === undefined ? [] : parseGroups(tail);
  if (left === null || right === null) return null;

  const groups =
    tail === undefined
      ? left
      : [...left, ...new Array(8 - left.length - right.length).fill(0), ...right];
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  groups.forEach((group, i) => {
    bytes[i * 2] = (group >>> 8) & 0xff;
    bytes[i * 2 + 1] = group & 0xff;
  });
  return bytes;
}

/** Compares the leading `bits` of two byte arrays. */
function bytesMatchPrefix(a: Uint8Array, b: Uint8Array, bits: number): boolean {
  const wholeBytes = bits >> 3;
  for (let i = 0; i < wholeBytes; i++) {
    if (a[i] !== b[i]) return false;
  }
  const remaining = bits & 7;
  if (remaining === 0) return true;
  const mask = (0xff << (8 - remaining)) & 0xff;
  return (a[wholeBytes] & mask) === (b[wholeBytes] & mask);
}

/**
 * Checks if a client IP matches a whitelist entry.
 *
 * Supports exact IPv4/IPv6 and CIDR in either family. IPv6 used to be missing
 * entirely, so on a network handing out IPv6 — which many consumer routers do
 * by default, and which a client prefers once it has one — no entry could ever
 * match and enabling the whitelist locked every admin out of the dashboard,
 * including from the LAN the entries described.
 */
function matchesEntry(clientIp: string, entry: string): boolean {
  entry = entry.trim();
  if (!entry) return false;

  // 1. Check exact IP match
  if (clientIp === entry) {
    return true;
  }

  if (!entry.includes("/")) {
    // An exact IPv6 entry can still match under a different spelling
    // (`fd00:0:0:0:0:0:0:1` vs `fd00::1`), so compare the parsed bytes.
    const entryBytes = ipv6ToBytes(entry);
    const clientBytes = entryBytes && ipv6ToBytes(clientIp);
    return Boolean(entryBytes && clientBytes && bytesMatchPrefix(entryBytes, clientBytes, 128));
  }

  const [range, maskStr] = entry.split("/");
  const mask = parseInt(maskStr, 10);
  if (isNaN(mask) || mask < 0) return false;

  // 2. IPv6 CIDR
  const rangeBytes = ipv6ToBytes(range);
  if (rangeBytes) {
    if (mask > 128) return false;
    const clientBytes = ipv6ToBytes(clientIp);
    return Boolean(clientBytes && bytesMatchPrefix(clientBytes, rangeBytes, mask));
  }

  // 3. IPv4 CIDR
  if (mask > 32) return false;
  const clientLong = ipToLong(clientIp);
  const rangeLong = ipToLong(range);

  if (clientLong !== null && rangeLong !== null) {
    // Create mask: e.g. /24 -> 0xFFFFFF00
    // Note: 1 << 32 is 1 in JS, so handle 0 separately if needed (though /0 is rare)
    const maskBits = mask === 0 ? 0 : (0xFFFFFFFF << (32 - mask)) >>> 0;
    return (clientLong & maskBits) === (rangeLong & maskBits);
  }

  return false;
}

/**
 * Main check function.
 */
export function isWhitelisted(clientIp: string, whitelistString: string): boolean {
  // Localhost is always allowed by default in this guard logic, 
  // but we also check the explicit whitelist string.
  const normalizedIp = clientIp.replace(/^::ffff:/, "").split("%")[0]; // Handle IPv4-mapped IPv6
  
  if (normalizedIp === "127.0.0.1" || normalizedIp === "::1") {
    return true;
  }

  const entries = whitelistString.split(",");
  return entries.some(entry => matchesEntry(normalizedIp, entry));
}

/**
 * Validates a whitelist string, returning an error message if it can never
 * work as written.
 *
 * The Settings panel used to offer `office.local` as an example entry, but a
 * whitelist entry is only ever compared against a numeric peer address, so a
 * hostname silently matched nothing — as did a typo like `192.168.1.0/33`.
 * Both produced a whitelist that looked configured and locked everyone out.
 */
export function validateWhitelist(value: string): string | undefined {
  const entries = value.split(",").map(e => e.trim()).filter(Boolean);
  if (entries.length === 0) {
    return "The whitelist must contain at least one IP address or CIDR range";
  }

  for (const entry of entries) {
    const [address, maskStr] = entry.includes("/") ? entry.split("/") : [entry, undefined];

    if (!net.isIP(address)) {
      return `"${entry}" is not an IP address or CIDR range. Hostnames cannot be matched — use the address itself.`;
    }
    if (maskStr === undefined) continue;

    const mask = Number(maskStr);
    const maxBits = net.isIPv6(address) ? 128 : 32;
    if (!Number.isInteger(mask) || mask < 0 || mask > maxBits) {
      return `"${entry}" has an invalid prefix length — expected 0 to ${maxBits}`;
    }
  }

  return undefined;
}

/**
 * Address ranges a client can legitimately sit on within the site.
 *
 * Deliberately a fixed list rather than `settings.adminWhitelist`, which an
 * admin may have widened to include public addresses so they can reach the
 * dashboard from off-site.
 */
const PRIVATE_RANGES = "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8";

/**
 * The IPv6 equivalents of the ranges above, matched on the leading bits:
 *
 *   fe80::/10  link-local, what an interface configures with no router
 *   fc00::/7   unique local (fc00::/8 and fd00::/8), the site-local range
 */
const isPrivateIPv6 = (ip: string): boolean => {
  const address = ip.toLowerCase().split('%')[0]; // strip any %eth0 zone index
  if (address === "::1" || address === "::") return true;
  if (/^fe[89ab][0-9a-f]:/.test(address)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(address)) return true;
  return false;
};

export const isPrivateAddress = (ip?: string): boolean => {
  if (!ip) return false;
  const normalized = ip.replace(/^::ffff:/, "");
  if (normalized === "::1") return true;
  if (normalized.includes(":")) return isPrivateIPv6(normalized);
  return isWhitelisted(normalized, PRIVATE_RANGES);
};

/**
 * Middleware to restrict access to whitelisted IPs.
 */
export const adminWhitelistGuard = (req: Request, res: Response, next: NextFunction) => {
  // Use req.ip.
  // req.ip can be IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  // 0. Skip check if whitelisting is disabled
  if (!settings.adminWhitelistEnabled) {
    return next();
  }

  const clientIp = req.ip || "";

  if (isWhitelisted(clientIp, settings.adminWhitelist)) {
    console.log(`[Whitelist] Access allowed for IP: ${clientIp}`);
    return next();
  }

  console.warn(`[Whitelist] Blocked access from IP: ${clientIp}`);
  res.status(403).json({ 
    error: "Access Denied", 
    message: "Your IP address is not in the administration whitelist."
  });
};
