export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  available: boolean;
  category: string;
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
}

export interface DailySummary {
  date: string;
  totalSales: number;
  orderCount: number;
}

export type AppState = 'kiosk' | 'manager';
