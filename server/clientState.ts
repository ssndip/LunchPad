import { settings } from "./config";
import { getMenu } from "./controllers/menuController";
import { kioskOpen } from "./controllers/statusController";

/**
 * Single source of truth for the state blob sent to clients on bootstrap.
 *
 * Used by both `GET /api/init` (public, unauthenticated) and the WebSocket
 * INITIAL_STATE frame, which previously carried two hand-maintained copies of
 * the same field list that had begun to drift.
 *
 * Secrets are gated on `isAdmin`: the AI provider key and the admin IP
 * whitelist are only ever serialised for an authenticated admin session.
 * Everyone else gets `aiApiKeyConfigured`, which is all the UI actually needs
 * to decide whether AI features are available.
 */
export const buildClientState = ({ isAdmin }: { isAdmin: boolean }) => ({
  menu: getMenu(),
  menuVersion: settings.menuVersion,
  kioskOpen,
  adminWhitelistEnabled: settings.adminWhitelistEnabled,
  orderButtonEnabled: settings.orderButtonEnabled,
  testModeEnabled: settings.testModeEnabled,
  kioskModeEnabled: settings.kioskModeEnabled,
  allowPWAInstall: settings.allowPWAInstall,
  systemLanguage: settings.systemLanguage,
  bgnEnabled: settings.bgnEnabled,
  menuDate: settings.menuDate,
  announcement: settings.announcement,
  aiProvider: settings.aiProvider,
  aiModel: settings.aiModel,
  aiEndpoint: settings.aiEndpoint,
  aiApiKeyConfigured: !!settings.aiApiKey,
  preIdentificationEnabled: settings.preIdentificationEnabled,
  kioskAutoTiming: settings.kioskAutoTiming,
  kioskOpenTime: settings.kioskOpenTime,
  kioskCloseTime: settings.kioskCloseTime,
  kioskCloseDay: settings.kioskCloseDay,
  deliveryFee: settings.deliveryFee || 0,
  packagingFee: settings.packagingFee || 0.1,
  publicAccessRequired: settings.publicAccessRequired,
  globalAccess: settings.globalAccess,

  // Admin-only fields. Omitted (rather than blanked) for non-admins so the
  // client's `!== undefined` hydration guards leave any existing value alone.
  ...(isAdmin
    ? {
        aiApiKey: settings.aiApiKey,
        adminWhitelist: settings.adminWhitelist,
      }
    : {}),
});
