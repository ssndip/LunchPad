/**
 * parserSync — keeps the menu parser's configuration on the server.
 *
 * The parser runs entirely in the browser (see menuParser.ts); the server never
 * reads any of this and only stores it. But storing it *only* in localStorage
 * had three consequences worth fixing:
 *
 *   - rules configured on the office desktop did not exist on the kiosk tablet;
 *   - clearing the browser's data wiped them with no warning;
 *   - the Settings backup panel lists "AI Parser Rules" among what a system
 *     backup contains, and the backup does export `parser_profiles` — but the
 *     real rules were never in that table, so the claim was false and a restore
 *     silently produced none of them.
 *
 * The whole client-side configuration travels as one profile under a well-known
 * id, through the bulk endpoints that already existed. Each push is recorded as
 * a new row in `parser_versions`, so the change history and the system backup
 * both come along for free.
 */
import { FormatPreset, ParserProfile } from './menuNormalizer';
import {
  DEFAULT_CATEGORY_SETTINGS,
  DEFAULT_SIDE_DISH_KEYWORD,
  ParserPersistence,
  loadCategorySettings,
  saveCategorySettings,
} from './parserLocalSettings';
import * as api from '../api';

const PRESETS_KEY = 'lunchpad_format_presets';
const PROFILES_KEY = 'lunchpad_parser_profiles';

/** The id this configuration always occupies on the server. */
export const PARSER_CONFIG_PROFILE_ID = 'dashboard-parser-config';

export interface ParserConfig {
  settings: ParserPersistence;
  presets: FormatPreset[];
  profiles: ParserProfile[];
}

const readList = <T,>(key: string): T[] => {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

/**
 * Puts a configuration's settings into the shape `loadCategorySettings`
 * returns, so the two sides of a comparison are in the same form.
 *
 * Reading from localStorage merges the stored categories over the defaults,
 * which reading from the server did not — so a configuration pushed by this
 * browser compared unequal to the very copy it had just sent, and the tab
 * announced a conflict on every visit.
 */
const normaliseSettings = (settings: any): ParserPersistence => ({
  categories: { ...DEFAULT_CATEGORY_SETTINGS, ...(settings?.categories ?? {}) },
  sideDishKeyword: settings?.sideDishKeyword ?? DEFAULT_SIDE_DISH_KEYWORD,
  sideDishKeywordEnabled: settings?.sideDishKeywordEnabled ?? true,
  activePresetId: settings?.activePresetId ?? null,
});

export const readLocalParserConfig = (): ParserConfig => ({
  settings: loadCategorySettings(),
  presets: readList<FormatPreset>(PRESETS_KEY),
  profiles: readList<ParserProfile>(PROFILES_KEY),
});

export const writeLocalParserConfig = (config: ParserConfig): void => {
  saveCategorySettings(config.settings);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(config.presets ?? []));
  localStorage.setItem(PROFILES_KEY, JSON.stringify(config.profiles ?? []));
};

/**
 * Whether a configuration holds anything the admin actually set up.
 *
 * Category settings always exist — `loadCategorySettings` returns defaults for
 * a browser that has never been used — so they cannot distinguish "configured"
 * from "untouched". Presets and profiles can.
 */
export const isEmptyParserConfig = (config: ParserConfig | null): boolean =>
  !config || ((config.presets?.length ?? 0) === 0 && (config.profiles?.length ?? 0) === 0);

/** Compares two configurations by value, ignoring key order. */
export const parserConfigsEqual = (a: ParserConfig | null, b: ParserConfig | null): boolean => {
  if (!a || !b) return a === b;
  const normalise = (config: ParserConfig) =>
    JSON.stringify({
      settings: normaliseSettings(config.settings),
      presets: config.presets ?? [],
      profiles: config.profiles ?? [],
    });
  return normalise(a) === normalise(b);
};

/** Reads the stored configuration, or null if the server holds none yet. */
export const pullParserConfig = async (token: string): Promise<ParserConfig | null> => {
  const bundle = await api.exportParserBundle(token);
  const stored = (bundle?.profiles ?? []).find(
    (profile: any) => profile.id === PARSER_CONFIG_PROFILE_ID,
  );
  const config = stored?.config;
  if (!config || typeof config !== 'object') return null;
  if (!config.settings && !config.presets && !config.profiles) return null;

  return {
    settings: normaliseSettings(config.settings),
    presets: Array.isArray(config.presets) ? config.presets : [],
    profiles: Array.isArray(config.profiles) ? config.profiles : [],
  };
};

export const pushParserConfig = async (token: string, config: ParserConfig): Promise<void> => {
  await api.importParserBundle(token, {
    version: '1.0',
    type: 'LUNCHPAD_PARSER_BUNDLE',
    exportedAt: new Date().toISOString(),
    profiles: [
      {
        id: PARSER_CONFIG_PROFILE_ID,
        name: 'Dashboard parser configuration',
        description: 'Category settings, format presets and saved snapshots from the Parser Rules tab.',
        isActive: 1,
        config,
      },
    ],
  });
};

/** What the first sync of a session decided, so the tab can react to it. */
export type ParserSyncOutcome =
  | { kind: 'in-sync' }
  | { kind: 'pulled'; config: ParserConfig }
  | { kind: 'pushed' }
  | { kind: 'conflict'; local: ParserConfig; server: ParserConfig }
  | { kind: 'failed'; error: string };

/**
 * Reconciles this browser with the server once, on entering the tab.
 *
 * The only case that cannot be decided automatically is both sides holding
 * different, non-empty configurations: picking either one silently destroys
 * somebody's work, so that is handed back as a conflict for the admin to
 * resolve. Everything else has an obvious answer.
 */
export const syncParserConfig = async (token: string): Promise<ParserSyncOutcome> => {
  const local = readLocalParserConfig();

  let server: ParserConfig | null;
  try {
    server = await pullParserConfig(token);
  } catch (err: any) {
    return { kind: 'failed', error: err?.message || 'Could not reach the server' };
  }

  if (parserConfigsEqual(local, server)) return { kind: 'in-sync' };

  if (isEmptyParserConfig(server)) {
    // Nothing to lose on the server: this browser seeds it.
    try {
      await pushParserConfig(token, local);
      return { kind: 'pushed' };
    } catch (err: any) {
      return { kind: 'failed', error: err?.message || 'Could not save to the server' };
    }
  }

  if (isEmptyParserConfig(local)) {
    // A fresh browser: take what the server has.
    writeLocalParserConfig(server!);
    return { kind: 'pulled', config: server! };
  }

  return { kind: 'conflict', local, server: server! };
};
