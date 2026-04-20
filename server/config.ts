import { db } from "./db";
import bcrypt from "bcryptjs";

if (!process.env.JWT_SECRET) {
  console.warn("[Config] WARNING: JWT_SECRET environment variable is not set. Using a default development secret. This is NOT recommended for production!");
}

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
  adminPin: process.env.ADMIN_PIN || "0000",
  jwtSecret: process.env.JWT_SECRET || "lunchpad-default-dev-secret-key-12345",
  enableTestBypass: process.env.ENABLE_TEST_BYPASS === 'true' || process.env.NODE_ENV !== 'production',
  adminWhitelist: "127.0.0.1, ::1, localhost, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12"
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
};
