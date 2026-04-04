export interface MenuItem {
  id: number;
  name: string;
  description?: string; // Optional — Feature 4 often lacks description
  price: number;
  available: boolean;
  category: string;
  hasIncludedSide?: boolean; // Feature 5: main dishes that include a side
}

// Feature 5: Cart item extends MenuItem with an optional chosen side dish
export interface CartItem extends MenuItem {
  side?: string;     // name of the selected side dish
  sidePrice?: number; // always 0 for included sides
}

export interface Order {
  id: number;
  rfid: string;
  ownerName?: string;
  items: MenuItem[];
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
}

export interface DailySummary {
  date: string;
  totalSales: number;
  orderCount: number;
}

// Feature 3: User profile returned by /api/cards/:rfid/profile
export interface UserProfile {
  rfid: string;
  ownerName: string;
  balance: number;
  isAdmin?: boolean;
  recentOrders: Order[]; // Feature 3: history from /profile endpoint
}

export type AppState = 'kiosk' | 'manager';
