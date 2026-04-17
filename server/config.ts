import { db } from "./db";
import bcrypt from "bcryptjs";

if (!process.env.JWT_SECRET) {
  console.warn("[Config] WARNING: JWT_SECRET environment variable is not set. Using a default development secret. This is NOT recommended for production!");
}

// --- Settings Object (Ensures live bindings across modules) ---
export const settings = {
  globalAccess: true,
  publicAccessCode: "",
  orderButtonEnabled: true,
  testModeEnabled: false,
  menuVersion: 1,
  packagingFee: 0.10,
  deliveryFee: 5.00,
  kioskModeEnabled: false,
  allowPWAInstall: true,
  adminPin: process.env.ADMIN_PIN || "0000",
  jwtSecret: process.env.JWT_SECRET
};

// --- Setters ---
export const setGlobalAccessConfig = (val: boolean) => settings.globalAccess = val;
export const setPublicAccessCodeConfig = (val: string) => settings.publicAccessCode = val;
export const setOrderButtonEnabledConfig = (val: boolean) => settings.orderButtonEnabled = val;
export const setTestModeConfig = (val: boolean) => settings.testModeEnabled = val;
export const setPackagingFeeConfig = (val: number) => settings.packagingFee = val;
export const setDeliveryFeeConfig = (val: number) => settings.deliveryFee = val;
export const setKioskModeConfig = (val: boolean) => settings.kioskModeEnabled = val;
export const setAllowPWAInstallConfig = (val: boolean) => settings.allowPWAInstall = val;

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
  const globalAccess = db.prepare("SELECT value FROM settings WHERE key = ?").get("global_access") as { value: string } | undefined;
  if (!globalAccess) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("global_access", "1");
    settings.globalAccess = true;
  } else {
    settings.globalAccess = globalAccess.value === "1";
  }

  const publicAccess = db.prepare("SELECT value FROM settings WHERE key = ?").get("public_access_code") as { value: string } | undefined;
  if (!publicAccess) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("public_access_code", "");
    settings.publicAccessCode = "";
  } else {
    settings.publicAccessCode = publicAccess.value;
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
