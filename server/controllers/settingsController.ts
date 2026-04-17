import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";
import { 
  settings,
  setGlobalAccessConfig, 
  setPublicAccessCodeConfig,
  setOrderButtonEnabledConfig, 
  setTestModeConfig,
  setPackagingFeeConfig,
  setDeliveryFeeConfig,
  setKioskModeConfig,
  setAllowPWAInstallConfig,
  setSystemLanguageConfig,
  hashAndSetAdminPin
} from "../config";
import { globalAccessGuard } from "../middleware/auth";
import { kioskOpen } from "./statusController";

export const fetchSettings = (req: Request, res: Response) => {
  res.json({ 
    globalAccess: settings.globalAccess,
    publicAccessCode: settings.publicAccessCode,
    orderButtonEnabled: settings.orderButtonEnabled,
    testModeEnabled: settings.testModeEnabled,
    packagingFee: settings.packagingFee,
    deliveryFee: settings.deliveryFee,
    kioskModeEnabled: settings.kioskModeEnabled,
    allowPWAInstall: settings.allowPWAInstall,
    systemLanguage: settings.systemLanguage
  });
};

export const updateSettings = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      globalAccess, publicAccessCode, orderButtonEnabled, testModeEnabled, 
      packagingFee, deliveryFee, kioskModeEnabled, allowPWAInstall,
      systemLanguage 
    } = req.body;
    
    if (globalAccess !== undefined) {
      if (typeof globalAccess !== 'boolean') return res.status(400).json({ error: "Invalid value for globalAccess" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("global_access", globalAccess ? "1" : "0");
      setGlobalAccessConfig(globalAccess); // ← critical: update in-memory state
      broadcast({ 
        type: "STATUS_UPDATE", 
        data: { 
          kioskOpen, 
          orderButtonEnabled: settings.orderButtonEnabled, 
          testModeEnabled: settings.testModeEnabled,
          globalAccess: globalAccess,
          publicAccessCode: settings.publicAccessCode
        } 
      });
    }

    if (publicAccessCode !== undefined) {
      if (typeof publicAccessCode !== 'string') return res.status(400).json({ error: "Invalid value for publicAccessCode" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("public_access_code", publicAccessCode);
      setPublicAccessCodeConfig(publicAccessCode);
      broadcast({ type: "STATUS_UPDATE", data: { kioskOpen, orderButtonEnabled: settings.orderButtonEnabled, testModeEnabled: settings.testModeEnabled, globalAccess: settings.globalAccess, publicAccessCode } });
    }

    if (orderButtonEnabled !== undefined) {
      if (typeof orderButtonEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for orderButtonEnabled" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("order_button_enabled", orderButtonEnabled ? "1" : "0");
      setOrderButtonEnabledConfig(orderButtonEnabled);
      broadcast({ type: "STATUS_UPDATE", data: { kioskOpen, orderButtonEnabled: orderButtonEnabled, testModeEnabled: settings.testModeEnabled, globalAccess: settings.globalAccess } });
    }

    if (testModeEnabled !== undefined) {
      if (typeof testModeEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for testModeEnabled" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("test_mode_enabled", testModeEnabled ? "1" : "0");
      setTestModeConfig(testModeEnabled);
      broadcast({ type: "STATUS_UPDATE", data: { kioskOpen, orderButtonEnabled: settings.orderButtonEnabled, testModeEnabled: testModeEnabled, globalAccess: settings.globalAccess, publicAccessCode: settings.publicAccessCode } });
    }
    
    if (packagingFee !== undefined) {
      if (typeof packagingFee !== 'number') return res.status(400).json({ error: "Invalid value for packagingFee" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("packaging_fee", String(packagingFee));
      setPackagingFeeConfig(packagingFee);
      // Broadcoast the update so the kiosk sees the new fee immediately
      broadcast({ type: "STATUS_UPDATE", data: { packagingFee } });
    }

    if (deliveryFee !== undefined) {
      if (typeof deliveryFee !== 'number') return res.status(400).json({ error: "Invalid value for deliveryFee" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("delivery_fee", String(deliveryFee));
      setDeliveryFeeConfig(deliveryFee);
      // Broadcoast the update
      broadcast({ type: "STATUS_UPDATE", data: { deliveryFee } });
    }

    if (kioskModeEnabled !== undefined) {
      if (typeof kioskModeEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for kioskModeEnabled" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("kiosk_mode_enabled", kioskModeEnabled ? "1" : "0");
      setKioskModeConfig(kioskModeEnabled);
      broadcast({ type: "PWA_SETTINGS_UPDATE", data: { kioskModeEnabled, allowPWAInstall: settings.allowPWAInstall } });
    }

    if (allowPWAInstall !== undefined) {
      if (typeof allowPWAInstall !== 'boolean') return res.status(400).json({ error: "Invalid value for allowPWAInstall" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("allow_pwa_install", allowPWAInstall ? "1" : "0");
      setAllowPWAInstallConfig(allowPWAInstall);
      broadcast({ type: "PWA_SETTINGS_UPDATE", data: { allowPWAInstall, kioskModeEnabled: settings.kioskModeEnabled } });
    }
    
    if (systemLanguage !== undefined) {
      if (typeof systemLanguage !== 'string') return res.status(400).json({ error: "Invalid value for systemLanguage" });
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("system_language", systemLanguage);
      setSystemLanguageConfig(systemLanguage);
      broadcast({ type: "STATUS_UPDATE", data: { 
        kioskOpen, 
        orderButtonEnabled: settings.orderButtonEnabled, 
        testModeEnabled: settings.testModeEnabled, 
        globalAccess: settings.globalAccess,
        systemLanguage 
      } });
    }

    res.json({ 
      success: true, 
      globalAccess: settings.globalAccess, 
      publicAccessCode: settings.publicAccessCode,
      orderButtonEnabled: settings.orderButtonEnabled, 
      testModeEnabled: settings.testModeEnabled,
      packagingFee: settings.packagingFee,
      deliveryFee: settings.deliveryFee,
      kioskModeEnabled: settings.kioskModeEnabled,
      allowPWAInstall: settings.allowPWAInstall,
      systemLanguage: settings.systemLanguage
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
