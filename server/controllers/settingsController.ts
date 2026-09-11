import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast, broadcastAdmin } from "../broadcast";
import { WsMessage } from "../../src/types/websocket";
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
  setAiModelConfig,
  setAiEndpointConfig,
  setPreIdentificationEnabledConfig,
  hashAndSetAdminPin,
  setKioskAutoTimingConfig,
  setKioskOpenTimeConfig,
  setKioskCloseTimeConfig,
  setKioskCloseDayConfig,
  setPublicAccessRequiredConfig,
  setPublicAccessCodeConfig,
  setGlobalAccessConfig
} from "../config";
import { kioskOpen } from "./statusController";

/** The settings projection returned to the dashboard. */
const currentSettings = () => ({ 
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
    aiApiKey: settings.aiApiKey,
    aiModel: settings.aiModel,
    aiEndpoint: settings.aiEndpoint,
    preIdentificationEnabled: settings.preIdentificationEnabled,
    customCategories: settings.customCategories,
    kioskAutoTiming: settings.kioskAutoTiming,
    kioskOpenTime: settings.kioskOpenTime,
    kioskCloseTime: settings.kioskCloseTime,
    kioskCloseDay: settings.kioskCloseDay,
    publicAccessRequired: settings.publicAccessRequired,
    publicAccessCode: settings.publicAccessCode,
    globalAccess: settings.globalAccess
});

export const fetchSettings = (req: Request, res: Response) => {
  res.json(currentSettings());
};

/**
 * One settable field: how to validate it, where it lives in the `settings`
 * table, how to apply it in memory, and what (if anything) clients are told.
 */
interface SettingSpec {
  /** Field name on the request body, and the name used in error messages. */
  name: string;
  dbKey: string;
  type: 'boolean' | 'number' | 'string' | 'array';
  /** Wrapped in a closure so the import is resolved at call time, not when
   *  this table is built — a module-level dereference breaks partial mocks. */
  apply: (value: any) => void;
  /** Extra validation beyond the type check; return an error message to reject. */
  check?: (value: any) => string | undefined;
  /** Built after the write, so the payload reflects committed state. */
  message?: () => WsMessage;
  /** Admin-only payloads (secrets) must not reach kiosk clients. */
  adminOnly?: boolean;
}

/** How a value is serialised into the settings table's TEXT column. */
const serialise = (type: SettingSpec['type'], value: any): string => {
  switch (type) {
    case 'boolean': return value ? '1' : '0';
    case 'number': return String(value);
    case 'array': return JSON.stringify(value);
    default: return value;
  }
};

const isValidType = (type: SettingSpec['type'], value: any): boolean => {
  switch (type) {
    case 'boolean': return typeof value === 'boolean';
    case 'number': return typeof value === 'number';
    case 'array': return Array.isArray(value);
    default: return typeof value === 'string';
  }
};

/**
 * A money amount the canteen charges. `typeof value === 'number'` alone let
 * through negatives — which turn a fee into a discount on every order — and
 * Infinity. NaN never reaches here, as JSON has no literal for it, but the
 * finiteness check costs nothing and states the intent.
 */
const amountCheck = (label: string) => (value: number): string | undefined =>
  (!Number.isFinite(value) || value < 0)
    ? `${label} must be a number of zero or more`
    : undefined;

/**
 * `kioskOpenTime`/`kioskCloseTime` are compared as strings against the current
 * HH:mm (see placeOrder), so any string at all was accepted and quietly changed
 * the comparison's meaning: "banana" sorts above every real time, so with auto
 * timing on the window never opened and the kiosk refused every order with
 * "outside operating hours" and no clue why.
 */
const isHHmm = (value: string): string | undefined =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? undefined
    : "Time must be in 24-hour HH:mm format";

/** 0 = Sunday .. 6 = Saturday, or -1 for "no closing day". */
const isCloseDay = (value: number): string | undefined =>
  (Number.isInteger(value) && value >= -1 && value <= 6)
    ? undefined
    : "Closing day must be a whole number from -1 (none) to 6";

const simpleUpdate = (settingsPatch: Record<string, any>): WsMessage =>
  ({ type: "SETTINGS_UPDATE", settings: settingsPatch } as WsMessage);

const SETTING_SPECS: SettingSpec[] = [
  { name: 'adminWhitelistEnabled', dbKey: 'admin_whitelist_enabled', type: 'boolean', apply: (v) => setAdminWhitelistEnabledConfig(v),
    message: () => simpleUpdate({ adminWhitelistEnabled: settings.adminWhitelistEnabled }) },
  { name: 'preIdentificationEnabled', dbKey: 'pre_identification_enabled', type: 'boolean', apply: (v) => setPreIdentificationEnabledConfig(v),
    message: () => simpleUpdate({ preIdentificationEnabled: settings.preIdentificationEnabled }) },
  { name: 'globalAccess', dbKey: 'global_access', type: 'boolean', apply: (v) => setGlobalAccessConfig(v),
    message: () => simpleUpdate({ globalAccess: settings.globalAccess }) },
  { name: 'orderButtonEnabled', dbKey: 'order_button_enabled', type: 'boolean', apply: (v) => setOrderButtonEnabledConfig(v),
    message: () => simpleUpdate({ orderButtonEnabled: settings.orderButtonEnabled }) },
  { name: 'testModeEnabled', dbKey: 'test_mode_enabled', type: 'boolean', apply: (v) => setTestModeConfig(v),
    message: () => simpleUpdate({ testModeEnabled: settings.testModeEnabled }) },
  { name: 'packagingFee', dbKey: 'packaging_fee', type: 'number', apply: (v) => setPackagingFeeConfig(v),
    check: amountCheck('Packaging fee'),
    message: () => simpleUpdate({ packagingFee: settings.packagingFee }) },
  { name: 'deliveryFee', dbKey: 'delivery_fee', type: 'number', apply: (v) => setDeliveryFeeConfig(v),
    check: amountCheck('Delivery fee'),
    message: () => simpleUpdate({ deliveryFee: settings.deliveryFee }) },
  // Both PWA flags are broadcast together, as the client expects the pair.
  { name: 'kioskModeEnabled', dbKey: 'kiosk_mode_enabled', type: 'boolean', apply: (v) => setKioskModeConfig(v),
    message: () => ({ type: "PWA_SETTINGS_UPDATE", kioskModeEnabled: settings.kioskModeEnabled, allowPWAInstall: settings.allowPWAInstall }) },
  { name: 'allowPWAInstall', dbKey: 'allow_pwa_install', type: 'boolean', apply: (v) => setAllowPWAInstallConfig(v),
    message: () => ({ type: "PWA_SETTINGS_UPDATE", kioskModeEnabled: settings.kioskModeEnabled, allowPWAInstall: settings.allowPWAInstall }) },
  { name: 'systemLanguage', dbKey: 'system_language', type: 'string', apply: (v) => setSystemLanguageConfig(v),
    message: () => simpleUpdate({ systemLanguage: settings.systemLanguage }) },
  { name: 'bgnEnabled', dbKey: 'bgn_enabled', type: 'boolean', apply: (v) => setBgnEnabledConfig(v),
    message: () => simpleUpdate({ bgnEnabled: settings.bgnEnabled }) },
  { name: 'adminWhitelist', dbKey: 'admin_whitelist', type: 'string', apply: (v) => setAdminWhitelistConfig(v), adminOnly: true,
    message: () => simpleUpdate({ adminWhitelist: settings.adminWhitelist }) },
  { name: 'announcement', dbKey: 'announcement', type: 'string', apply: (v) => setAnnouncementConfig(v),
    message: () => simpleUpdate({ announcement: settings.announcement }) },
  { name: 'aiProvider', dbKey: 'ai_provider', type: 'string', apply: (v) => setAiProviderConfig(v),
    message: () => simpleUpdate({ aiProvider: settings.aiProvider }) },
  { name: 'aiApiKey', dbKey: 'ai_api_key', type: 'string', apply: (v) => setAiApiKeyConfig(v), adminOnly: true,
    message: () => simpleUpdate({ aiApiKey: settings.aiApiKey }) },
  { name: 'aiModel', dbKey: 'ai_model', type: 'string', apply: (v) => setAiModelConfig(v),
    message: () => simpleUpdate({ aiModel: settings.aiModel }) },
  { name: 'aiEndpoint', dbKey: 'ai_endpoint', type: 'string', apply: (v) => setAiEndpointConfig(v),
    message: () => simpleUpdate({ aiEndpoint: settings.aiEndpoint }) },
  { name: 'customCategories', dbKey: 'custom_categories', type: 'array', apply: (v) => { settings.customCategories = v; },
    message: () => simpleUpdate({ customCategories: settings.customCategories }) },
  { name: 'kioskAutoTiming', dbKey: 'kiosk_auto_timing', type: 'boolean', apply: (v) => setKioskAutoTimingConfig(v),
    message: () => simpleUpdate({ kioskAutoTiming: settings.kioskAutoTiming }) },
  { name: 'kioskOpenTime', dbKey: 'kiosk_open_time', type: 'string', apply: (v) => setKioskOpenTimeConfig(v),
    check: isHHmm,
    message: () => simpleUpdate({ kioskOpenTime: settings.kioskOpenTime }) },
  { name: 'kioskCloseTime', dbKey: 'kiosk_close_time', type: 'string', apply: (v) => setKioskCloseTimeConfig(v),
    check: isHHmm,
    message: () => simpleUpdate({ kioskCloseTime: settings.kioskCloseTime }) },
  { name: 'kioskCloseDay', dbKey: 'kiosk_close_day', type: 'number', apply: (v) => setKioskCloseDayConfig(v),
    check: isCloseDay,
    message: () => simpleUpdate({ kioskCloseDay: settings.kioskCloseDay }) },
  { name: 'publicAccessRequired', dbKey: 'public_access_required', type: 'boolean', apply: (v) => setPublicAccessRequiredConfig(v),
    message: () => simpleUpdate({ publicAccessRequired: settings.publicAccessRequired }) },
  // Deliberately not broadcast: the code itself must not reach kiosk clients.
  { name: 'publicAccessCode', dbKey: 'public_access_code', type: 'string', apply: (v) => setPublicAccessCodeConfig(v),
    check: (v) => (v.length > 0 && !/^\d{4,6}$/.test(v))
      ? "Public access code must be between 4 and 6 digits and contain only numbers"
      : undefined },
];

/**
 * Apply a partial settings update.
 *
 * Every provided field is validated before anything is written. This used to be
 * a chain of inline blocks that each wrote to the database and broadcast as it
 * went, so a bad field part-way down returned 400 having already committed and
 * announced the fields ahead of it — the dashboard reported a failed save while
 * the server had quietly kept half of it.
 */
export const updateSettings = (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body ?? {};
    const provided = SETTING_SPECS.filter(spec => body[spec.name] !== undefined);

    // 1. Validate everything up front.
    for (const spec of provided) {
      const value = body[spec.name];
      if (!isValidType(spec.type, value)) {
        return res.status(400).json({ error: `Invalid value for ${spec.name}` });
      }
      const problem = spec.check?.(value);
      if (problem) {
        return res.status(400).json({ error: problem });
      }
    }

    // 2. Persist as one unit, so a failure part-way leaves nothing applied.
    db.transaction(() => {
      const upsert = db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );
      for (const spec of provided) {
        upsert.run(spec.dbKey, serialise(spec.type, body[spec.name]));
      }
    })();

    // 3. Only now update the in-memory config and tell clients.
    for (const spec of provided) spec.apply(body[spec.name]);
    for (const spec of provided) {
      const message = spec.message?.();
      if (!message) continue;
      if (spec.adminOnly) broadcastAdmin(message);
      else broadcast(message);
    }

    res.json({ success: true, ...currentSettings() });
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
    if (!/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({ error: "PIN must be between 4 and 6 digits and contain only numbers" });
    }
    hashAndSetAdminPin(newPin);
    res.json({ success: true });
  } catch (err: any) {
    next(err);
  }
};
