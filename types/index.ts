// ─── types/index.ts ───────────────────────────────────────

export type OrderStatus = "new" | "cooking" | "done" | "cancelled";

export interface Department {
  id: string;
  name: string;
  active: boolean;
}

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
}

export interface OrderItem {
  id: number;
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: number;
  dept_id: string;
  customer_name: string;
  items: OrderItem[];
  note: string | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  departments?: Department;
}

export interface Announcement {
  id: number;
  message: string;
  created_at: string;
}
