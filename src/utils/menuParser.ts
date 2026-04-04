/**
 * menuParser.ts — Feature 4: Smart Menu Text Parser
 * Pure function — no React dependency. Fully unit-testable.
 *
 * Handles:
 *  - Date detection (DD.MM.YYYY, DD/MM/YYYY, DD-MM-YY)
 *  - Price detection with € $ лв and comma decimals
 *  - Category vs. item discrimination (price = item)
 *  - Bulgarian → English category translation
 */
import { MenuItem } from '../types';

export interface ParseResult {
  detectedDate?: string;
  items: MenuItem[];
}

// ─── Regex ────────────────────────────────────────────────────────────────────

const DATE_RE = /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/;

/** Matches a price at end of line, with optional currency symbol */
const PRICE_RE = /([\d]+[,.][\d]+|[\d]+)\s*[€$лв]/;

// ─── Category Translation ─────────────────────────────────────────────────────

const BG_CATEGORY_MAP: Record<string, string> = {
  'Супи': 'Soups',
  'Основни ястия': 'Main Dishes',
  'Гарнитури': 'Side Dishes',
  'Гарнитура': 'Side Dishes',
  'Закуски': 'Snacks',
  'Десерти': 'Desserts',
  'Напитки': 'Drinks',
  'Салати': 'Salads',
  'Предястия': 'Starters',
  'Риба': 'Fish',
};

function translateCategory(raw: string): string {
  const trimmed = raw.trim().replace(/:$/, '').trim();
  // Exact match first
  if (BG_CATEGORY_MAP[trimmed]) return BG_CATEGORY_MAP[trimmed];
  // Substring match
  for (const [bg, en] of Object.entries(BG_CATEGORY_MAP)) {
    if (trimmed.includes(bg)) return en;
  }
  return trimmed;
}

// ─── Price extraction ─────────────────────────────────────────────────────────

function extractPrice(line: string): number | null {
  const match = line.match(PRICE_RE);
  if (!match) return null;
  // Normalize comma as decimal separator
  const normalized = match[1].replace(',', '.');
  const val = parseFloat(normalized);
  return isNaN(val) ? null : val;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parsePastedMenu(text: string): ParseResult {
  const lines = text.split('\n');
  const items: MenuItem[] = [];
  let currentId = Date.now();
  let currentCategory = 'General';
  let detectedDate: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // ── Date detection (only first hit) ──────────────────────────────────────
    if (!detectedDate) {
      const dateMatch = line.match(DATE_RE);
      if (dateMatch) {
        detectedDate = dateMatch[1];
        // If the line is ONLY a date, skip it entirely
        if (line.replace(DATE_RE, '').replace(/\s/g, '').length === 0) continue;
      }
    }

    const price = extractPrice(line);

    if (price !== null) {
      // ── Item line ──────────────────────────────────────────────────────────
      // Strip the price token and leading punctuation
      let name = line.replace(PRICE_RE, '').replace(/^[-•*]\s*/, '').trim();
      // Strip trailing commas / dots
      name = name.replace(/[,.\s]+$/, '').trim();

      if (name.length > 0) {
        items.push({
          id: currentId++,
          name,
          description: '',
          price,
          available: true,
          category: currentCategory,
        });
      }
    } else if (line.length > 2 && !line.startsWith('-') && !line.startsWith('•')) {
      // ── Category line ──────────────────────────────────────────────────────
      currentCategory = translateCategory(line);
    }
  }

  return { detectedDate, items };
}
