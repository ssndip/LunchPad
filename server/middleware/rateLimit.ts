import rateLimit from "express-rate-limit";
import { isWhitelisted } from "./whitelist";
import { settings } from "../config";

export const profileRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes for external IPs
  skip: (req) => {
    const clientIp = req.ip || "";
    return isWhitelisted(clientIp, settings.adminWhitelist);
  },
  message: { error: "Too many requests, please try again later." }
});
