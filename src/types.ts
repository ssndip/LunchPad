export interface ExtraFee {
  type: string;
  amount: number;
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  basePrice: number;        // Feature 7: original price before fees
  price: number;            // Total price after applied fees
  available: boolean;
  category: string;
  tags: string[];           // Feature 7: tag-based rules (e.g. "bbq", "side")
  extraFees: ExtraFee[];    // Feature 7: breakout of fees (e.g. container fee)
  packagingFee?: number;    // Single item packaging fee
  hasIncludedSide?: boolean;
  requiresSideChoice?: boolean; // Feature 7: trigger side dish selection
  selectedSide?: string;        // Feature 7: pre-selected side dish name
  sideChoices?: string[];
  _debug?: {                    // Match metadata for UI debugging
    matchedLine: string;
    ruleId?: string;
    ruleType?: 'section' | 'extraction' | 'enrichment';
  };
  date?: string; // Feature: specific date for this item (YYYY-MM-DD)
}

// Feature 5: Cart item extends MenuItem with an optional chosen side dish
export interface CartItem extends MenuItem {
  side?: string;     // name of the selected side dish
  sidePrice?: number; // always 0 for included sides
  quantity: number;   // New field for multiple pieces
}

/** Strictly typed item for database persistence in the orders table */
export interface PersistedOrderItem extends MenuItem {
  side?: string;
}

export interface Order {
  id: number;
  rfid: string;
  ownerName?: string;
  items: PersistedOrderItem[];
  totalPrice: number;
  timestamp: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface Card {
  rfid: string;
  ownerName: string;
  balance: number;
  isAdmin?: boolean;
  pin?: string;
}

export interface DailySummary {
  date: string;
  totalSales: number;
  orderCount: number;
  uniqueUserCount: number;
  feeDistributed?: boolean;
  distributedAmount?: number;
}

// Feature 3: User profile returned by /api/cards/:rfid/profile
export interface UserProfile {
  rfid: string;
  ownerName: string;
  balance: number;
  isAdmin?: boolean;
  orders: Order[];
}

export type AppState = 'kiosk' | 'manager';

export interface Settings {
  adminWhitelistEnabled: boolean;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  packagingFee: number;
  deliveryFee: number;
  kioskModeEnabled: boolean;
  allowPWAInstall: boolean;
  systemLanguage: string;
  bgnEnabled: boolean;
  adminWhitelist: string;
  announcement: string;
  aiProvider: string;
  aiApiKey: string;
  preIdentificationEnabled: boolean;
  adminPin: string;
}
