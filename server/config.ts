import { db } from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

if (!process.env.JWT_SECRET) {
  console.warn("[Config] WARNING: JWT_SECRET environment variable is not set. Using a default development secret. This is NOT recommended for production!");
}

/**
 * Hash a card PIN.
 *
 * Deterministic on purpose: checkout looks a PIN up with an indexed equality
 * match, which a per-row salt would turn into a full scan. The security comes
 * from the pepper, which never leaves the server.
 *
 * That pepper used to be `settings.jwtSecret`, which tied every stored PIN to a
 * value operators are told to rotate. Rotating it — or restoring a backup
 * carrying a different one — invalidated every PIN at once, and because the
 * migration below treats any 64-character value as already hashed, it could
 * never repair itself. `pin_pepper` is seeded from the JWT secret the first
 * time (so hashes written under the old scheme keep verifying) and then stays
 * put. See initSettings.
 */
export const hashPin = (pin: string): string => {
  const pepper = settings.pinPepper || settings.jwtSecret || "lunchpad-default-dev-secret-key-12345";
  return crypto.createHmac("sha256", pepper).update(pin).digest("hex");
};

/**
 * PIN used when nothing else has been configured, so a fresh install is
 * reachable. Overridden by the ADMIN_PIN environment variable, and retired for
 * good the moment an admin sets a PIN in the dashboard.
 */
export const DEFAULT_ADMIN_PIN = "0000";

/** Constant-time comparison, so a wrong PIN reveals nothing through timing. */
const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(String(a), "utf8");
  const bufB = Buffer.from(String(b), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const cleanRfid = (rfid: string | null | undefined): string => {
  return String(rfid || "").trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
};

/**
 * Express `trust proxy` value, from the TRUST_PROXY environment variable.
 *
 * Defaults to `false`: believing X-Forwarded-For while the server is directly
 * reachable lets any client choose its own `req.ip`, which defeats the admin IP
 * whitelist and the skip rules on both rate limiters.
 *
 * Behind a reverse proxy, prefer an address list naming who may set the header
 * (`loopback, uniquelocal` for an nginx on the same host or docker network)
 * over a hop count. A hop count trusts whoever connected, so it reopens the
 * spoof for anyone reaching this server directly — which is the normal case
 * when the same deployment is also served over the LAN on http://<ip>:PORT.
 */
export const parseTrustProxy = (raw?: string): boolean | number | string => {
  const value = (raw || "").trim();
  if (value === "" || value === "0" || value.toLowerCase() === "false") return false;
  if (value.toLowerCase() === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value; // Express also accepts "loopback" or a comma-separated subnet list
};

// --- Settings Object (Ensures live bindings across modules) ---
export const settings = {
  // Off by default: a new install is reachable from anywhere, and an admin
  // turns the whitelist on from Settings once they know which networks should
  // keep access. See the seeding block below for what this means for the very
  // first boot — in particular that it leaves the default PIN as the only
  // thing standing in front of the dashboard.
  adminWhitelistEnabled: false,
  orderButtonEnabled: true,
  testModeEnabled: false,
  menuVersion: 1,
  packagingFee: 0.10,
  deliveryFee: 5.00,
  kioskModeEnabled: false,
  allowPWAInstall: true,
  systemLanguage: "bg",
  menuDate: "",
  bgnEnabled: true,
  announcement: "",
  aiProvider: "openai",
  aiApiKey: "",
  aiModel: "",
  aiEndpoint: "",
  preIdentificationEnabled: false,
  publicAccessCode: "",
  publicAccessRequired: false,
  adminPin: "",
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex"),
  /** Key for hashPin. Seeded once and deliberately never rotated. */
  pinPepper: "",
  enableTestBypass: process.env.ENABLE_TEST_BYPASS === 'true' || process.env.NODE_ENV !== 'production',
  adminWhitelist: process.env.ADMIN_WHITELIST || "127.0.0.1, ::1, localhost, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12",
  kioskAutoTiming: false,
  kioskOpenTime: "08:00",
  kioskCloseTime: "11:00",
  kioskCloseDay: 0,
  customCategories: [] as any[],
  globalAccess: false
};

// --- Setters ---
export const setAdminWhitelistEnabledConfig = (val: boolean) => settings.adminWhitelistEnabled = val;
export const setOrderButtonEnabledConfig = (val: boolean) => settings.orderButtonEnabled = val;
export const setTestModeConfig = (val: boolean) => settings.testModeEnabled = val;
export const setPackagingFeeConfig = (val: number) => settings.packagingFee = val;
export const setDeliveryFeeConfig = (val: number) => settings.deliveryFee = val;
export const setKioskModeConfig = (val: boolean) => settings.kioskModeEnabled = val;
export const setAllowPWAInstallConfig = (val: boolean) => settings.allowPWAInstall = val;
export const setSystemLanguageConfig = (val: string) => settings.systemLanguage = val;
export const setBgnEnabledConfig = (val: boolean) => settings.bgnEnabled = val;
export const setAdminWhitelistConfig = (val: string) => settings.adminWhitelist = val;
export const setAnnouncementConfig = (val: string) => settings.announcement = val;
export const setAiProviderConfig = (val: string) => settings.aiProvider = val;
export const setAiApiKeyConfig = (val: string) => settings.aiApiKey = val;
export const setAiModelConfig = (val: string) => settings.aiModel = val;
export const setAiEndpointConfig = (val: string) => settings.aiEndpoint = val;
export const setPreIdentificationEnabledConfig = (val: boolean) => settings.preIdentificationEnabled = val;
export const setPublicAccessCodeConfig = (val: string) => settings.publicAccessCode = val;
export const setPublicAccessRequiredConfig = (val: boolean) => settings.publicAccessRequired = val;
export const setKioskAutoTimingConfig = (val: boolean) => settings.kioskAutoTiming = val;
export const setKioskOpenTimeConfig = (val: string) => settings.kioskOpenTime = val;
export const setKioskCloseTimeConfig = (val: string) => settings.kioskCloseTime = val;
export const setKioskCloseDayConfig = (val: number) => settings.kioskCloseDay = val;
export const setGlobalAccessConfig = (val: boolean) => settings.globalAccess = val;

export const incrementMenuVersion = () => {
  settings.menuVersion += 1;
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run("menu_version", String(settings.menuVersion));
  return settings.menuVersion;
};

/**
 * Why `verifyAdminPin` last refused, when the reason was a configuration
 * problem rather than a wrong PIN.
 *
 * The refusal below is correct, but it only ever reached the server console —
 * the dashboard said "Invalid PIN or Admin Card", so a new operator following
 * the setup had no way to learn that the fix is to set ADMIN_PIN or re-enable
 * the whitelist. The login route reads this to explain itself.
 */
export let lastPinRefusalReason: string | null = null;

export const verifyAdminPin = (pin: string): boolean => {
  lastPinRefusalReason = null;
  try {
    const adminPinRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("admin_pin") as { value: string } | undefined;
    if (adminPinRecord && adminPinRecord.value) {
      const dbVal = adminPinRecord.value;
      const isHashed = dbVal.startsWith("$2a$") || dbVal.startsWith("$2b$");
      if (isHashed) {
        return bcrypt.compareSync(pin, dbVal);
      } else {
        return safeEqual(pin, dbVal);
      }
    }
    // No PIN stored yet: fall back to ADMIN_PIN, or DEFAULT_ADMIN_PIN so a fresh
    // install can be logged into. This branch used to also accept "0000"
    // unconditionally, which kept the default working as a second, permanent
    // password even after ADMIN_PIN had been changed.
    const effectivePin = process.env.ADMIN_PIN || DEFAULT_ADMIN_PIN;

    // Refuse the one combination that is an open door: no PIN of anyone's
    // choosing anywhere (so the password is the published default) AND no IP
    // restriction (so the whole internet can reach this endpoint). Either
    // alone is defensible — a default PIN behind a whitelist is a LAN-only
    // convenience, and an open whitelist with a real PIN is an ordinary
    // remote login. Together they are not.
    //
    // This is deliberately narrow. Setting ADMIN_PIN to anything of your own
    // clears it, as does storing a PIN from Settings, as does turning the
    // whitelist back on. It exists so that shipping the whitelist off by
    // default cannot, on its own, publish an unprotected dashboard.
    if (!settings.adminWhitelistEnabled && effectivePin === DEFAULT_ADMIN_PIN) {
      lastPinRefusalReason =
        "Admin login is disabled until this install is configured: the PIN is still the " +
        "factory default and the admin whitelist is off, which together would leave the " +
        "dashboard open to anyone who can reach this host. Set ADMIN_PIN to a PIN of your " +
        "own, or re-enable the admin whitelist, then restart and log in.";
      console.warn(
        "[Auth] Refused an admin login: the PIN is still the default and the " +
          "admin whitelist is off, which would leave the dashboard open to " +
          "anyone who can reach this host. Set ADMIN_PIN to a PIN of your own, " +
          "or re-enable the whitelist, then log in.",
      );
      return false;
    }

    return safeEqual(pin, effectivePin);
  } catch (err) {
    console.error("[Auth] PIN verification error", err);
    return false;
  }
};

/**
 * Hashes a new PIN and updates the config.
 */
export const hashAndSetAdminPin = (newPin: string) => {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(newPin, salt);
  settings.adminPin = hash;
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("admin_pin", hash);
};

export const initSettings = () => {
  // Load or persist JWT Secret in SQLite settings to avoid user lockouts on restart if process.env.JWT_SECRET is unset
  let secret = process.env.JWT_SECRET;
  if (!secret) {
    const dbSecret = db.prepare("SELECT value FROM settings WHERE key = ?").get("jwt_secret") as { value: string } | undefined;
    if (dbSecret && dbSecret.value) {
      secret = dbSecret.value;
    } else {
      secret = crypto.randomBytes(32).toString("hex");
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("jwt_secret", secret);
      console.log("[Config] Generated and persisted new secure JWT secret in database settings");
    }
  }
  settings.jwtSecret = secret;

  // Seed the PIN pepper before anything hashes a PIN. On an existing install
  // this adopts the JWT secret the stored hashes were made with, so they keep
  // verifying; from here on the two are independent and rotating JWT_SECRET no
  // longer locks every cardholder out.
  const pepperRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("pin_pepper") as { value: string } | undefined;
  if (pepperRecord && pepperRecord.value) {
    settings.pinPepper = pepperRecord.value;
  } else {
    settings.pinPepper = settings.jwtSecret;
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run("pin_pepper", settings.pinPepper);
    console.log("[Config] Seeded PIN pepper from the current JWT secret; card PINs are now independent of JWT_SECRET");
  }

  const whitelistEnabled = db.prepare("SELECT value FROM settings WHERE key = ?").get("admin_whitelist_enabled") as { value: string } | undefined;
  if (!whitelistEnabled) {
    // Seeded off, so the dashboard is reachable remotely out of the box and an
    // admin restricts it deliberately rather than having to get onto the LAN
    // to do the initial setup at all.
    //
    // This only ever applies to a database that has no row yet. An existing
    // install keeps whatever it was set to — changing this value does not
    // reopen a deployment where someone already turned the whitelist on.
    //
    // On a first boot it does mean the PIN is the only thing in front of the
    // dashboard, and until one is set that PIN is DEFAULT_ADMIN_PIN. The
    // warning further down fires for exactly that case; it is worth heeding on
    // a host that is reachable from outside the building.
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("admin_whitelist_enabled", "0");
    settings.adminWhitelistEnabled = false;
  } else {
    settings.adminWhitelistEnabled = whitelistEnabled.value === "1";
  }

  // Environment override to disable admin whitelist (e.g. for initial setup over public IP)
  if (process.env.DISABLE_ADMIN_WHITELIST === 'true') {
    settings.adminWhitelistEnabled = false;
  }

  const orderButton = db.prepare("SELECT value FROM settings WHERE key = ?").get("order_button_enabled") as { value: string } | undefined;
  if (!orderButton) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("order_button_enabled", "1");
    settings.orderButtonEnabled = true;
  } else {
    settings.orderButtonEnabled = orderButton.value === "1";
  }

  const globalAccessRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("global_access") as { value: string } | undefined;
  if (!globalAccessRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("global_access", "0");
    settings.globalAccess = false;
  } else {
    settings.globalAccess = globalAccessRecord.value === "1";
  }

  const testMode = db.prepare("SELECT value FROM settings WHERE key = ?").get("test_mode_enabled") as { value: string } | undefined;
  if (!testMode) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("test_mode_enabled", "0");
    settings.testModeEnabled = false;
  } else {
    settings.testModeEnabled = testMode.value === "1";
  }

  const menuVer = db.prepare("SELECT value FROM settings WHERE key = ?").get("menu_version") as { value: string } | undefined;
  if (!menuVer) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("menu_version", "1");
    settings.menuVersion = 1;
  } else {
    settings.menuVersion = parseInt(menuVer.value) || 1;
  }

  const packagingFeeRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("packaging_fee") as { value: string } | undefined;
  if (!packagingFeeRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("packaging_fee", "0.10");
    settings.packagingFee = 0.1;
  } else {
    settings.packagingFee = parseFloat(packagingFeeRecord.value) || 0.1;
  }

  const deliveryFeeRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("delivery_fee") as { value: string } | undefined;
  if (!deliveryFeeRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("delivery_fee", "5.00");
    settings.deliveryFee = 5.0;
  } else {
    settings.deliveryFee = parseFloat(deliveryFeeRecord.value) || 5.0;
  }
  
  const kioskModeRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("kiosk_mode_enabled") as { value: string } | undefined;
  if (!kioskModeRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("kiosk_mode_enabled", "0");
    settings.kioskModeEnabled = false;
  } else {
    settings.kioskModeEnabled = kioskModeRecord.value === "1";
  }

  const allowPWAInstallRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("allow_pwa_install") as { value: string } | undefined;
  if (!allowPWAInstallRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("allow_pwa_install", "1");
    settings.allowPWAInstall = true;
  } else {
    settings.allowPWAInstall = allowPWAInstallRecord.value === "1";
  }

  const systemLanguageRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("system_language") as { value: string } | undefined;
  if (!systemLanguageRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("system_language", "bg");
    settings.systemLanguage = "bg";
  } else {
    settings.systemLanguage = systemLanguageRecord.value;
  }

  const menuDateRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("menu_date") as { value: string } | undefined;
  if (!menuDateRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("menu_date", "");
    settings.menuDate = "";
  } else {
    settings.menuDate = menuDateRecord.value || "";
  }
  
  const bgnEnabledRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("bgn_enabled") as { value: string } | undefined;
  if (!bgnEnabledRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("bgn_enabled", "1");
    settings.bgnEnabled = true;
  } else {
    settings.bgnEnabled = bgnEnabledRecord.value === "1";
  }
  
  const whitelistRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("admin_whitelist") as { value: string } | undefined;
  if (!whitelistRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("admin_whitelist", settings.adminWhitelist);
  } else {
    settings.adminWhitelist = whitelistRecord.value;
  }

  // Environment override for custom whitelist entries
  if (process.env.ADMIN_WHITELIST) {
    settings.adminWhitelist = process.env.ADMIN_WHITELIST;
  }
  
  const announcementRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("announcement") as { value: string } | undefined;
  if (!announcementRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("announcement", "");
    settings.announcement = "";
  } else {
    settings.announcement = announcementRecord.value;
  }
  
  const aiProviderRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("ai_provider") as { value: string } | undefined;
  if (!aiProviderRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("ai_provider", "openai");
    settings.aiProvider = "openai";
  } else {
    settings.aiProvider = aiProviderRecord.value;
  }

  const aiApiKeyRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("ai_api_key") as { value: string } | undefined;
  if (!aiApiKeyRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("ai_api_key", "");
    settings.aiApiKey = "";
  } else {
    settings.aiApiKey = aiApiKeyRecord.value;
  }

  const aiModelRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("ai_model") as { value: string } | undefined;
  if (!aiModelRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("ai_model", "");
    settings.aiModel = "";
  } else {
    settings.aiModel = aiModelRecord.value;
  }

  const aiEndpointRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("ai_endpoint") as { value: string } | undefined;
  if (!aiEndpointRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("ai_endpoint", "");
    settings.aiEndpoint = "";
  } else {
    settings.aiEndpoint = aiEndpointRecord.value;
  }

  const preIdentRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("pre_identification_enabled") as { value: string } | undefined;
  if (!preIdentRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("pre_identification_enabled", "0");
    settings.preIdentificationEnabled = false;
  } else {
    settings.preIdentificationEnabled = preIdentRecord.value === "1";
  }

  const publicAccessCodeRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("public_access_code") as { value: string } | undefined;
  if (!publicAccessCodeRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("public_access_code", "");
    settings.publicAccessCode = "";
  } else {
    settings.publicAccessCode = publicAccessCodeRecord.value;
  }

  const publicAccessRequiredRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("public_access_required") as { value: string } | undefined;
  if (!publicAccessRequiredRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("public_access_required", "0");
    settings.publicAccessRequired = false;
  } else {
    settings.publicAccessRequired = publicAccessRequiredRecord.value === "1";
  }

  const kioskAutoTimingRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("kiosk_auto_timing") as { value: string } | undefined;
  if (!kioskAutoTimingRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("kiosk_auto_timing", "0");
    settings.kioskAutoTiming = false;
  } else {
    settings.kioskAutoTiming = kioskAutoTimingRecord.value === "1";
  }

  const kioskOpenTimeRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("kiosk_open_time") as { value: string } | undefined;
  if (!kioskOpenTimeRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("kiosk_open_time", "08:00");
    settings.kioskOpenTime = "08:00";
  } else {
    settings.kioskOpenTime = kioskOpenTimeRecord.value || "08:00";
  }

  const kioskCloseTimeRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("kiosk_close_time") as { value: string } | undefined;
  if (!kioskCloseTimeRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("kiosk_close_time", "11:00");
    settings.kioskCloseTime = "11:00";
  } else {
    settings.kioskCloseTime = kioskCloseTimeRecord.value || "11:00";
  }

  const kioskCloseDayRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("kiosk_close_day") as { value: string } | undefined;
  if (!kioskCloseDayRecord) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("kiosk_close_day", "0");
    settings.kioskCloseDay = 0;
  } else {
    settings.kioskCloseDay = parseInt(kioskCloseDayRecord.value) || 0;
  }
  
  const adminPinRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("admin_pin") as { value: string } | undefined;
  if (adminPinRecord && adminPinRecord.value) {
    let currentPin = adminPinRecord.value;
    const isHashed = currentPin.startsWith("$2a$") || currentPin.startsWith("$2b$");
    if (!isHashed) {
      console.log("[Config] Migrating plain-text PIN to bcrypt hash...");
      const salt = bcrypt.genSaltSync(10);
      currentPin = bcrypt.hashSync(currentPin, salt);
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("admin_pin", currentPin);
    }
    settings.adminPin = currentPin;
  } else {
    settings.adminPin = "";
    if ((process.env.ADMIN_PIN || DEFAULT_ADMIN_PIN) === DEFAULT_ADMIN_PIN) {
      console.warn(
        `[Config] WARNING: No admin PIN is set, so the default "${DEFAULT_ADMIN_PIN}" grants dashboard access. ` +
        `Set one in Settings, or via the ADMIN_PIN environment variable.`
      );
    }
  }

  const customCatsRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("custom_categories") as { value: string } | undefined;
  if (!customCatsRecord) {
    // Seed with legacy defaults
    const legacyCategories = [
      { id: "soups", names: { en: "Soups", bg: "Супи" }, keywords: ["супи"], color: "orange" },
      { id: "mains", names: { en: "Main Dishes", bg: "Основни ястия" }, keywords: ["основно ястие", "основни ястия"], color: "blue" },
      { id: "salads", names: { en: "Salads", bg: "Салати" }, keywords: ["салати"], color: "green" },
      { id: "bread", names: { en: "Bread", bg: "Хляб" }, keywords: ["хляб"], color: "amber" },
      { id: "sides", names: { en: "Side Dishes", bg: "Гарнитури" }, keywords: ["гарнитури"], color: "teal" },
      { id: "bbq", names: { en: "BBQ", bg: "Скара" }, keywords: ["скара"], color: "red" },
      { id: "desserts", names: { en: "Desserts", bg: "Десерти" }, keywords: ["десерти"], color: "purple" },
      { id: "other", names: { en: "Other", bg: "Други" }, keywords: ["други"], color: "neutral" }
    ];
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("custom_categories", JSON.stringify(legacyCategories));
    settings.customCategories = legacyCategories;
  } else {
    try {
      settings.customCategories = JSON.parse(customCatsRecord.value);
    } catch {
      settings.customCategories = [];
    }
  }

  // Auto-migration: If card PINs are plain-text, hash them now
  try {
    const userCards = db.prepare("SELECT rfid, pin FROM cards WHERE pin IS NOT NULL").all() as any[];
    let migratedCount = 0;
    
    db.transaction(() => {
      const updateStmt = db.prepare("UPDATE cards SET pin = ? WHERE rfid = ?");
      userCards.forEach(c => {
        // A blank PIN is the absence of one. Hashing it gave every such card
        // the same value, which is both meaningless and a uniqueness conflict.
        if (!String(c.pin).trim()) {
          updateStmt.run(null, c.rfid);
          return;
        }
        // Plain-text user PIN is a 6-digit numeric string, never a 64-character hex digest.
        const isHashed = /^[0-9a-f]{64}$/i.test(c.pin);
        if (!isHashed) {
          const hashed = hashPin(c.pin);
          updateStmt.run(hashed, c.rfid);
          migratedCount++;
        }
      });
    })();
    
    if (migratedCount > 0) {
      console.log(`[Config] Migrated ${migratedCount} plain-text user PINs to SHA-256 HMAC hashes...`);
    }
  } catch (err) {
    console.error("[Config] User card PIN migration error", err);
  }
};

