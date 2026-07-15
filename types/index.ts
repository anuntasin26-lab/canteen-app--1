// ─── types/index.ts ───────────────────────────────────────

export type OrderStatus = "new" | "cooking" | "done" | "cancelled";

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  emoji: string;
  available: boolean;
  sort_order: number;
  ingredients?: string;
  image_url?: string | null;
  daily_limit?: number | null;      // null = ไม่จำกัด
  remaining_today?: number | null;  // null = ไม่จำกัด, มาจาก view menu_items_with_remaining
}

export interface OrderItem {
  id: number;
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: number;
  customer_name: string;
  items: OrderItem[];
  note: string | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  access_token: string;
}

export interface Announcement {
  id: number;
  message: string;
  created_at: string;
}
