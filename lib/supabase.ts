// ─── lib/supabase.ts ──────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// ── Departments ───────────────────────────────────────────
export async function getDepartmentById(id: string) {
  const { data, error } = await supabase
    .from("departments").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

// ── Menu Items ────────────────────────────────────────────
export async function getMenuItems() {
  const { data, error } = await supabase
    .from("menu_items").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

/** ครัวเปิด/ปิดเมนู */
export async function toggleMenuItem(id: number, available: boolean) {
  const { error } = await supabase
    .from("menu_items").update({ available }).eq("id", id);
  if (error) throw error;
}

/** ครัวแก้ราคาเมนู */
export async function updateMenuPrice(id: number, price: number) {
  const { error } = await supabase
    .from("menu_items").update({ price }).eq("id", id);
  if (error) throw error;
}

// ── Orders ────────────────────────────────────────────────

/** ออร์เดอร์วันนี้ (ครัว) */
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

/** ประวัติออร์เดอร์ย้อนหลัง (ครัว) — เลือกได้กี่วัน */
export async function getOrderHistory(days = 7) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("orders")
    .select("*, departments(id, name)")
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** ประวัติออร์เดอร์ของแผนกนั้น (user) */
export async function getDeptHistory(deptId: string, days = 7) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("dept_id", deptId)
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** สร้างออร์เดอร์ */
export async function createOrder(payload: {
  dept_id: string;
  customer_name: string;
  items: { id: number; name: string; qty: number; price: number }[];
  note?: string;
  total: number;
}) {
  const { data, error } = await supabase
    .from("orders").insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** อัปเดต status */
export async function updateOrderStatus(id: number, status: "cooking" | "done") {
  const extra =
    status === "cooking"
      ? { started_at: new Date().toISOString() }
      : { completed_at: new Date().toISOString() };
  const { error } = await supabase
    .from("orders").update({ status, ...extra }).eq("id", id);
  if (error) throw error;
}

/** ลบออร์เดอร์ */
export async function deleteOrder(id: number) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

// ── Realtime ──────────────────────────────────────────────
export function subscribeToOrders(
  callback: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: any;
    old: any;
  }) => void
) {
  return supabase
    .channel("orders-realtime")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => callback({
        eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
        new: payload.new,
        old: payload.old,
      })
    )
    .subscribe();
}

export function subscribeToMenuItems(callback: (payload: any) => void) {
  return supabase
    .channel("menu-realtime")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "menu_items" },
      callback
    )
    .subscribe();
}
