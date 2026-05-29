import { db } from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

if (!process.env.JWT_SECRET) {
  console.warn("[Config] WARNING: JWT_SECRET environment variable is not set. Using a default development secret. This is NOT recommended for production!");
}

export const hashPin = (pin: string): string => {
  return crypto.createHmac("sha256", settings.jwtSecret || "lunchpad-default-dev-secret-key-12345").update(pin).digest("hex");
};

export const cleanRfid = (rfid: string | null | undefined): string => {
  return String(rfid || "").trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
};

// --- Settings Object (Ensures live bindings across modules) ---
export const settings = {
  adminWhitelistEnabled: true,
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
  preIdentificationEnabled: false,
  publicAccessCode: "",
  publicAccessRequired: false,
  adminPin: process.env.ADMIN_PIN || "0000",
  jwtSecret: process.env.JWT_SECRET || "lunchpad-default-dev-secret-key-12345",
  enableTestBypass: process.env.ENABLE_TEST_BYPASS === 'true' || process.env.NODE_ENV !== 'production',
  adminWhitelist: "127.0.0.1, ::1, localhost, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12",
  kioskAutoTiming: false,
  kioskOpenTime: "08:00",
  kioskCloseTime: "11:00",
  kioskCloseDay: 0,
  customCategories: [] as any[]
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
export const setPreIdentificationEnabledConfig = (val: boolean) => settings.preIdentificationEnabled = val;
export const setPublicAccessCodeConfig = (val: string) => settings.publicAccessCode = val;
export const setPublicAccessRequiredConfig = (val: boolean) => settings.publicAccessRequired = val;
export const setKioskAutoTimingConfig = (val: boolean) => settings.kioskAutoTiming = val;
export const setKioskOpenTimeConfig = (val: string) => settings.kioskOpenTime = val;
export const setKioskCloseTimeConfig = (val: string) => settings.kioskCloseTime = val;
export const setKioskCloseDayConfig = (val: number) => settings.kioskCloseDay = val;

export const incrementMenuVersion = () => {
  settings.menuVersion += 1;
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run("menu_version", String(settings.menuVersion));
  return settings.menuVersion;
};

/**
 * Verifies if the provided PIN matches the hashed admin PIN.
 */
export const verifyAdminPin = (pin: string): boolean => {
  try {
    return bcrypt.compareSync(pin, settings.adminPin);
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
  const whitelistEnabled = db.prepare("SELECT value FROM settings WHERE key = ?").get("admin_whitelist_enabled") as { value: string } | undefined;
  if (!whitelistEnabled) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("admin_whitelist_enabled", "1");
    settings.adminWhitelistEnabled = true;
  } else {
    settings.adminWhitelistEnabled = whitelistEnabled.value === "1";
  }

  const orderButton = db.prepare("SELECT value FROM settings WHERE key = ?").get("order_button_enabled") as { value: string } | undefined;
  if (!orderButton) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("order_button_enabled", "1");
    settings.orderButtonEnabled = true;
  } else {
    settings.orderButtonEnabled = orderButton.value === "1";
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
  let currentPin = adminPinRecord ? adminPinRecord.value : settings.adminPin;

  // Auto-migration: If PIN is not hashed, hash it now
  const isHashed = currentPin.startsWith("$2a$") || currentPin.startsWith("$2b$");
  if (!isHashed) {
    console.log("[Config] Migrating plain-text PIN to bcrypt hash...");
    const salt = bcrypt.genSaltSync(10);
    currentPin = bcrypt.hashSync(currentPin, salt);
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("admin_pin", currentPin);
  }
  
  settings.adminPin = currentPin;

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
        // Plain-text user PIN is typically a 6-digit numeric string (not a 64-character SHA-256 hex string)
        const isHashed = c.pin.length === 64; 
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

