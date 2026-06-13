// ─── lib/supabase.ts ──────────────────────────────────────
//
//  ใส่ใน .env.local:
//    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
//
// ─────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// client เดียวใช้ทั้งแอป (singleton)
export const supabase = createClient(url, key);

// ── Departments ───────────────────────────────────────────

export async function getDepartments() {
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getDepartmentById(id: string) {
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ── Menu Items ────────────────────────────────────────────

export async function getMenuItems() {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data;
}

// ── Orders ────────────────────────────────────────────────

/** ดึงออร์เดอร์วันนี้ทั้งหมด (ครัวใช้) */
export async function getTodayOrders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("orders")
    .select("*, departments(id, name)")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** สร้างออร์เดอร์ใหม่ (ลูกค้าใช้) */
export async function createOrder(payload: {
  dept_id: string;
  customer_name: string;
  items: { id: number; name: string; qty: number; price: number }[];
  note?: string;
  total: number;
}) {
  const { data, error } = await supabase
    .from("orders")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** อัปเดต status (ครัวใช้) */
export async function updateOrderStatus(
  id: number,
  status: "cooking" | "done"
) {
  const extra =
    status === "cooking"
      ? { started_at: new Date().toISOString() }
      : { completed_at: new Date().toISOString() };

  const { error } = await supabase
    .from("orders")
    .update({ status, ...extra })
    .eq("id", id);
  if (error) throw error;
}

/** ลบออร์เดอร์ */
export async function deleteOrder(id: number) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

// ── Realtime subscription ─────────────────────────────────
//
//  ใช้ใน component ฝั่ง Kitchen:
//
//  useEffect(() => {
//    const channel = subscribeToOrders((payload) => {
//      if (payload.eventType === "INSERT") {
//        setOrders(prev => [payload.new, ...prev])
//      }
//      if (payload.eventType === "UPDATE") {
//        setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
//      }
//      if (payload.eventType === "DELETE") {
//        setOrders(prev => prev.filter(o => o.id !== payload.old.id))
//      }
//    })
//    return () => { supabase.removeChannel(channel) }
//  }, [])
//
export function subscribeToOrders(
  callback: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: any;
    old: any;
  }) => void
) {
  return supabase
    .channel("orders-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => {
        callback({
          eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          new: payload.new,
          old: payload.old,
        });
      }
    )
    .subscribe();
}
