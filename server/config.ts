import { db } from "./db";
import bcrypt from "bcryptjs";

// --- Settings Cache ---
export let globalAccessConfig = true;
export let orderButtonEnabledConfig = true;
export let testModeConfig = false;
export let adminPinConfig = process.env.ADMIN_PIN || "0000";

export const setGlobalAccessConfig = (val: boolean) => globalAccessConfig = val;
export const setOrderButtonEnabledConfig = (val: boolean) => orderButtonEnabledConfig = val;
export const setTestModeConfig = (val: boolean) => testModeConfig = val;
export const setAdminPinConfig = (val: string) => adminPinConfig = val;

/**
 * Verifies if the provided PIN matches the hashed admin PIN.
 */
export const verifyAdminPin = (pin: string): boolean => {
  try {
    return bcrypt.compareSync(pin, adminPinConfig);
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
  adminPinConfig = hash;
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("admin_pin", hash);
};

export const initSettings = () => {
  const globalAccess = db.prepare("SELECT value FROM settings WHERE key = ?").get("global_access") as { value: string } | undefined;
  if (!globalAccess) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("global_access", "1");
    globalAccessConfig = true;
  } else {
    globalAccessConfig = globalAccess.value === "1";
  }

  const orderButton = db.prepare("SELECT value FROM settings WHERE key = ?").get("order_button_enabled") as { value: string } | undefined;
  if (!orderButton) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("order_button_enabled", "1");
    orderButtonEnabledConfig = true;
  } else {
    orderButtonEnabledConfig = orderButton.value === "1";
  }

  const testMode = db.prepare("SELECT value FROM settings WHERE key = ?").get("test_mode_enabled") as { value: string } | undefined;
  if (!testMode) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("test_mode_enabled", "0");
    testModeConfig = false;
  } else {
    testModeConfig = testMode.value === "1";
  }

  const adminPinRecord = db.prepare("SELECT value FROM settings WHERE key = ?").get("admin_pin") as { value: string } | undefined;
  let currentPin = adminPinRecord ? adminPinRecord.value : adminPinConfig;

  // Auto-migration: If PIN is not hashed, hash it now
  const isHashed = currentPin.startsWith("$2a$") || currentPin.startsWith("$2b$");
  if (!isHashed) {
    console.log("[Config] Migrating plain-text PIN to bcrypt hash...");
    const salt = bcrypt.genSaltSync(10);
    currentPin = bcrypt.hashSync(currentPin, salt);
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("admin_pin", currentPin);
  }
  
  adminPinConfig = currentPin;
};
