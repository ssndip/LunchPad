import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";
import { 
  settings,
  setAdminWhitelistEnabledConfig, 
  setOrderButtonEnabledConfig, 
  setTestModeConfig,
  setPackagingFeeConfig,
  setDeliveryFeeConfig,
  setKioskModeConfig,
  setAllowPWAInstallConfig,
  setSystemLanguageConfig,
  setBgnEnabledConfig,
  setAdminWhitelistConfig,
  setAnnouncementConfig,
  setAiProviderConfig,
  setAiApiKeyConfig,
  hashAndSetAdminPin
} from "../config";
import { kioskAccessGuard } from "../middleware/auth";
import { kioskOpen } from "./statusController";

export const fetchSettings = (req: Request, res: Response) => {
  res.json({ 
    adminWhitelistEnabled: settings.adminWhitelistEnabled,
    orderButtonEnabled: settings.orderButtonEnabled,
    testModeEnabled: settings.testModeEnabled,
    packagingFee: settings.packagingFee,
    deliveryFee: settings.deliveryFee,
    kioskModeEnabled: settings.kioskModeEnabled,
    allowPWAInstall: settings.allowPWAInstall,
    systemLanguage: settings.systemLanguage,
    bgnEnabled: settings.bgnEnabled,
    adminWhitelist: settings.adminWhitelist,
    announcement: settings.announcement,
    aiProvider: settings.aiProvider,
    aiApiKey: settings.aiApiKey
  });
};

export const updateSettings = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, 
      packagingFee, deliveryFee, kioskModeEnabled, allowPWAInstall,
      systemLanguage, bgnEnabled, adminWhitelist, announcement,
      aiProvider, aiApiKey
    } = req.body;
    
    if (adminWhitelistEnabled !== undefined) {
      if (typeof adminWhitelistEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for adminWhitelistEnabled" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("admin_whitelist_enabled", adminWhitelistEnabled ? "1" : "0");
      setAdminWhitelistEnabledConfig(adminWhitelistEnabled);
      broadcast({ 
        type: "SETTINGS_UPDATE", 
        settings: { 
          adminWhitelistEnabled: adminWhitelistEnabled,
        } 
      });
    }



    if (orderButtonEnabled !== undefined) {
      if (typeof orderButtonEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for orderButtonEnabled" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("order_button_enabled", orderButtonEnabled ? "1" : "0");
      setOrderButtonEnabledConfig(orderButtonEnabled);
      broadcast({ type: "SETTINGS_UPDATE", settings: { orderButtonEnabled } });
    }

    if (testModeEnabled !== undefined) {
      if (typeof testModeEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for testModeEnabled" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("test_mode_enabled", testModeEnabled ? "1" : "0");
      setTestModeConfig(testModeEnabled);
      broadcast({ type: "SETTINGS_UPDATE", settings: { testModeEnabled } });
    }
    
    if (packagingFee !== undefined) {
      if (typeof packagingFee !== 'number') return res.status(400).json({ error: "Invalid value for packagingFee" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("packaging_fee", String(packagingFee));
      setPackagingFeeConfig(packagingFee);
      // Broadcoast the update so the kiosk sees the new fee immediately
      broadcast({ type: "SETTINGS_UPDATE", settings: { packagingFee } as any }); // Added packagingFee to type or keep as any for now
    }

    if (deliveryFee !== undefined) {
      if (typeof deliveryFee !== 'number') return res.status(400).json({ error: "Invalid value for deliveryFee" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("delivery_fee", String(deliveryFee));
      setDeliveryFeeConfig(deliveryFee);
      // Broadcoast the update
      broadcast({ type: "SETTINGS_UPDATE", settings: { deliveryFee } as any });
    }

    if (kioskModeEnabled !== undefined) {
      if (typeof kioskModeEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for kioskModeEnabled" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("kiosk_mode_enabled", kioskModeEnabled ? "1" : "0");
      setKioskModeConfig(kioskModeEnabled);
      broadcast({ type: "PWA_SETTINGS_UPDATE", kioskModeEnabled, allowPWAInstall: settings.allowPWAInstall });
    }

    if (allowPWAInstall !== undefined) {
      if (typeof allowPWAInstall !== 'boolean') return res.status(400).json({ error: "Invalid value for allowPWAInstall" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("allow_pwa_install", allowPWAInstall ? "1" : "0");
      setAllowPWAInstallConfig(allowPWAInstall);
      broadcast({ type: "PWA_SETTINGS_UPDATE", allowPWAInstall, kioskModeEnabled: settings.kioskModeEnabled });
    }
    
    if (systemLanguage !== undefined) {
      if (typeof systemLanguage !== 'string') return res.status(400).json({ error: "Invalid value for systemLanguage" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("system_language", systemLanguage);
      setSystemLanguageConfig(systemLanguage);
      broadcast({ type: "SETTINGS_UPDATE", settings: { systemLanguage } as any });
    }
    
    if (bgnEnabled !== undefined) {
      if (typeof bgnEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for bgnEnabled" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("bgn_enabled", bgnEnabled ? "1" : "0");
      setBgnEnabledConfig(bgnEnabled);
      broadcast({ type: "SETTINGS_UPDATE", settings: { bgnEnabled } as any });
    }
    
    if (adminWhitelist !== undefined) {
      if (typeof adminWhitelist !== 'string') return res.status(400).json({ error: "Invalid value for adminWhitelist" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("admin_whitelist", adminWhitelist);
      setAdminWhitelistConfig(adminWhitelist);
      broadcast({ type: "SETTINGS_UPDATE", settings: { adminWhitelist } as any });
    }
    
    if (announcement !== undefined) {
      if (typeof announcement !== 'string') return res.status(400).json({ error: "Invalid value for announcement" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("announcement", announcement);
      setAnnouncementConfig(announcement);
      broadcast({ type: "SETTINGS_UPDATE", settings: { announcement } as any });
    }

    if (aiProvider !== undefined) {
      if (typeof aiProvider !== 'string') return res.status(400).json({ error: "Invalid value for aiProvider" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("ai_provider", aiProvider);
      setAiProviderConfig(aiProvider);
    }

    if (aiApiKey !== undefined) {
      if (typeof aiApiKey !== 'string') return res.status(400).json({ error: "Invalid value for aiApiKey" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("ai_api_key", aiApiKey);
      setAiApiKeyConfig(aiApiKey);
    }

    res.json({ 
      success: true, 
      adminWhitelistEnabled: settings.adminWhitelistEnabled, 
      orderButtonEnabled: settings.orderButtonEnabled, 
      testModeEnabled: settings.testModeEnabled,
      packagingFee: settings.packagingFee,
      deliveryFee: settings.deliveryFee,
      kioskModeEnabled: settings.kioskModeEnabled,
      allowPWAInstall: settings.allowPWAInstall,
      systemLanguage: settings.systemLanguage,
      bgnEnabled: settings.bgnEnabled,
      adminWhitelist: settings.adminWhitelist,
      announcement: settings.announcement,
      aiProvider: settings.aiProvider,
      aiApiKey: settings.aiApiKey
    });
  } catch (err: any) {
    next(err);
  }
};

export const updatePin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newPin } = req.body;
    if (!newPin || typeof newPin !== 'string') {
      return res.status(400).json({ error: "Invalid PIN" });
    }
    hashAndSetAdminPin(newPin);
    res.json({ success: true });
  } catch (err: any) {
    next(err);
  }
};
