// ─── lib/supabase.ts ──────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// persistSession: false — ไม่เก็บ session ลง localStorage เลย
// ทำให้ทุกครั้งที่รีเฟรช/เปิดหน้าใหม่ ต้อง login ใหม่เสมอ (ตามที่ตกลงไว้)
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

// ── Staff Auth (ใช้ร่วมกันทั้ง /kitchen และ /admin) ─────────
/** Login ด้วย email/password — คืน error message ภาษาไทยถ้าล้มเหลว */
export async function signInStaff(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutStaff() {
  await supabase.auth.signOut();
}

export async function getStaffSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** ลูกค้าแก้ชื่อของออเดอร์ตัวเอง — ต้องมี access_token ที่ถูกต้อง (เช็คฝั่ง DB ผ่าน RPC) */
export async function renameOwnOrder(orderId: number, token: string, newName: string) {
  const { data, error } = await supabase.rpc("rename_own_order", {
    p_order_id: orderId,
    p_access_token: token,
    p_new_name: newName,
  });
  if (error) {
    const e: any = new Error(error.message);
    e.code = error.message?.split(":")[0];
    throw e;
  }
  return data;
}

/** ลูกค้ายกเลิกออเดอร์ตัวเอง — ต้องมี access_token ที่ถูกต้อง (เช็คฝั่ง DB ผ่าน RPC) */
export async function cancelOwnOrder(orderId: number, token: string) {
  const { data, error } = await supabase.rpc("cancel_own_order", {
    p_order_id: orderId,
    p_access_token: token,
  });
  if (error) throw error;
  return data;
}

// ── Menu Items ────────────────────────────────────────────
export async function getMenuItems() {
  const { data, error } = await supabase
    .from("menu_items_with_remaining").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

/** ครัวเปิด/ปิดเมนู */
export async function toggleMenuItem(id: number, available: boolean) {
  const { error } = await supabase
    .from("menu_items").update({ available }).eq("id", id);
  if (error) throw error;
}

/** ครัวแก้ไขเมนู: ชื่อ, ราคา, วัตถุดิบ, โควตา/วัน — แล้วบันทึก log อัตโนมัติ */
export async function updateMenuItem(id: number, fields: {
  name?: string;
  price?: number;
  ingredients?: string;
  image_url?: string | null;
  daily_limit?: number | null;
}) {
  const { error } = await supabase
    .from("menu_items").update(fields).eq("id", id);
  if (error) throw error;

  const { data: item } = await supabase
    .from("menu_items").select("*").eq("id", id).single();
  if (item) {
    await supabase.from("menu_history_log").insert({
      menu_id: id,
      name: item.name,
      price: item.price,
      available: item.available,
    });
  }
}

/** ครัวเพิ่มเมนูใหม่ */
export async function createMenuItem(fields: {
  name: string;
  price: number;
  category: string;
  emoji?: string;
  ingredients?: string;
  image_url?: string | null;
  daily_limit?: number | null;
}) {
  const { data, error } = await supabase
    .from("menu_items")
    .insert({ ...fields, available: true, sort_order: 999 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** ครัวลบเมนู */
export async function deleteMenuItem(id: number) {
  const { error } = await supabase
    .from("menu_items").delete().eq("id", id);
  if (error) throw error;
}

// ── Menu Images (Supabase Storage) ─────────────────────────
// ต้องสร้าง bucket ชื่อ "menu-images" แบบ Public ใน Supabase Dashboard
// (Storage → New bucket → ตั้งชื่อ "menu-images" → เปิด Public bucket)
// ดูขั้นตอนเต็มในไฟล์ menu_images_setup.sql

const MENU_IMAGE_BUCKET = "menu-images";
const MAX_MENU_IMAGE_MB = 5;

/** อัปโหลดรูปเมนู แล้วคืน public URL — ใช้ตอนเพิ่ม/แก้ไขเมนู */
export async function uploadMenuImage(file: File, menuId?: number) {
  if (!file.type.startsWith("image/")) {
    throw new Error("ไฟล์ต้องเป็นรูปภาพเท่านั้น");
  }
  if (file.size > MAX_MENU_IMAGE_MB * 1024 * 1024) {
    throw new Error(`รูปต้องมีขนาดไม่เกิน ${MAX_MENU_IMAGE_MB}MB`);
  }
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${menuId ?? "new"}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase
    .storage.from(MENU_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl as string;
}

/** ลบรูปเมนูเก่าออกจาก storage (เรียกตอนเปลี่ยนรูปใหม่ หรือลบเมนู) */
export async function deleteMenuImage(imageUrl: string) {
  try {
    const path = imageUrl.split(`${MENU_IMAGE_BUCKET}/`).pop();
    if (!path) return;
    await supabase.storage.from(MENU_IMAGE_BUCKET).remove([path]);
  } catch {
    // ไม่ต้อง throw — ลบรูปเก่าไม่สำเร็จไม่ควรบล็อกการทำงานหลัก
  }
}

// ── Announcements ────────────────────────────────────────
/** ครัวประกาศแจ้งเตือนถึงทุก user */
export async function createAnnouncement(message: string) {
  const { error } = await supabase
    .from("announcements").insert({ message });
  if (error) throw error;
}

/** ดึงประกาศล่าสุดของวันนี้ (ลูกค้าใช้แสดง banner) */
export async function getTodayAnnouncement() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export function subscribeToAnnouncements(callback: (payload: any) => void) {
  return supabase
    .channel("announcements-realtime")
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "announcements" },
      callback
    )
    .subscribe();
}

// ── Menu History ──────────────────────────────────────────
/** ดูเมนูย้อนหลังตามวัน */
export async function getMenuHistory(days = 7) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("menu_history_log")
    .select("*")
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ── Orders ────────────────────────────────────────────────
export async function getTodayOrders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("orders_with_items")
    .select("*")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getOrderHistory(days = 7) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("orders_with_items")
    .select("*")
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * สร้างออเดอร์ใหม่ผ่าน RPC เดียวแบบ atomic — ราคาคำนวณจาก menu_items
 * จริงฝั่ง server เสมอ (ไม่เชื่อราคาที่ client ส่งมา) กันการปลอมราคา
 */
export async function createOrder(payload: {
  customer_name: string;
  items: { id: number; qty: number }[];
  note?: string;
}) {
  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: payload.customer_name,
    p_items: payload.items,
    p_note: payload.note ?? null,
  });
  if (error) {
    const e: any = new Error(error.message);
    e.code = error.message?.split(":")[0];
    throw e;
  }
  return data;
}

/**
 * เพิ่มรายการเข้าออร์เดอร์เดิมที่ยังเป็น "new" (ยังไม่เริ่มทำ) ผ่าน RPC
 * แบบ atomic เดียวกัน — ตรวจ access_token + สถานะ + คำนวณราคาใหม่ฝั่ง server
 * ใช้แทน createOrder เมื่อกด "สั่งอาหารเพิ่ม" ระหว่างที่ออร์เดอร์เดิมยังรอ
 */
export async function addItemsToOrder(
  orderId: number,
  token: string,
  newItems: { id: number; qty: number }[],
  extraNote?: string
) {
  const { data, error } = await supabase.rpc("add_items_to_order", {
    p_order_id: orderId,
    p_access_token: token,
    p_items: newItems,
    p_extra_note: extraNote ?? null,
  });
  if (error) {
    // แปลง error message จาก Postgres ('ORDER_ALREADY_STARTED' ฯลฯ) ให้ตรวจสอบง่ายฝั่ง UI
    const e: any = new Error(error.message);
    e.code = error.message?.split(":")[0];
    throw e;
  }
  return data;
}

export async function updateOrderStatus(id: number, status: "cooking" | "done") {
  const extra =
    status === "cooking"
      ? { started_at: new Date().toISOString() }
      : { completed_at: new Date().toISOString() };
  const { error } = await supabase
    .from("orders").update({ status, ...extra }).eq("id", id);
  if (error) throw error;
}

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

// ── Custom Orders (ตามสั่ง) ───────────────────────────────

export interface CustomOrder {
  id: number;
  customer_name: string;
  items: string;       // free text เช่น "ข้าวผัดกระเพราหมูสับ x2"
  note: string | null;
  status: "new" | "cooking" | "done" | "cancelled";
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/** ลูกค้าสั่งอาหารตามสั่ง — ผ่าน RPC (เช็คคำหยาบฝั่ง server) */
export async function createCustomOrder(payload: {
  customer_name: string;
  items: string;
  note?: string;
}) {
  const { data, error } = await supabase.rpc("create_custom_order", {
    p_customer_name: payload.customer_name,
    p_items: payload.items,
    p_note: payload.note ?? null,
  });
  if (error) {
    const e: any = new Error(error.message);
    e.code = error.message?.split(":")[0];
    throw e;
  }
  return data as CustomOrder;
}

/** ครัวดูออเดอร์ตามสั่งวันนี้ */
export async function getTodayCustomOrders() {
  const today = new Date(); today.setHours(0,0,0,0);
  const { data, error } = await supabase
    .from("custom_orders")
    .select("*")
    .gte("created_at", today.toISOString())
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as CustomOrder[];
}

/** ครัวอัปเดต status ตามสั่ง */
export async function updateCustomOrderStatus(
  id: number,
  status: "cooking" | "done"
) {
  const extra = status === "cooking"
    ? { started_at: new Date().toISOString() }
    : { completed_at: new Date().toISOString() };
  const { error } = await supabase
    .from("custom_orders")
    .update({ status, ...extra })
    .eq("id", id);
  if (error) throw error;
}

/** ครัวยกเลิกออเดอร์ตามสั่ง */
export async function cancelCustomOrder(id: number) {
  const { error } = await supabase
    .from("custom_orders")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw error;
}

/** Realtime สำหรับ custom_orders */
export function subscribeToCustomOrders(
  callback: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: any;
    old: any;
  }) => void
) {
  return supabase
    .channel("custom-orders-realtime")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "custom_orders" },
      (payload) => callback({
        eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
        new: payload.new,
        old: payload.old,
      })
    )
    .subscribe();
}

// ── Blacklist คำหยาบ (จัดการจากหน้า /admin) ──────────────────
export async function getBlacklistWords() {
  const { data, error } = await supabase
    .from("blacklist_words").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as { id: number; word: string; created_at: string }[];
}

export async function addBlacklistWord(word: string) {
  const { data, error } = await supabase
    .from("blacklist_words").insert({ word }).select().single();
  if (error) throw error;
  return data;
}

export async function removeBlacklistWord(id: number) {
  const { error } = await supabase.from("blacklist_words").delete().eq("id", id);
  if (error) throw error;
}

// ── Flagging (ครัวรายงานชื่อที่หลุดผ่านมาได้) ─────────────────
/** ครัวกด flag ชื่อบนตั๋วออเดอร์ — เข้าคิวให้ /admin ตรวจสอบทีหลัง */
export async function flagOrderName(orderId: number, text: string) {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase.from("flagged_names").insert({
    order_id: orderId,
    flagged_text: text,
    flagged_by: session.user?.id ?? null,
  });
  if (error) throw error;
}

export async function getFlaggedNames() {
  const { data, error } = await supabase
    .from("flagged_names").select("*").eq("reviewed", false).order("created_at", { ascending: false });
  if (error) throw error;
  return data as { id: number; order_id: number | null; custom_order_id: number | null; flagged_text: string; created_at: string; reviewed: boolean }[];
}

/** Admin ตรวจคิว flag: เพิ่มเข้า blacklist แล้วปิดเรื่อง หรือแค่ปิดเรื่องเฉย ๆ (ไม่ใช่คำหยาบจริง) */
export async function resolveFlaggedName(id: number, addToBlacklist: boolean, word?: string) {
  if (addToBlacklist && word) {
    await addBlacklistWord(word);
  }
  const { error } = await supabase.from("flagged_names").update({ reviewed: true }).eq("id", id);
  if (error) throw error;
}

// ── Audit log (ดูได้จาก /admin) ──────────────────────────
export async function getAuditLog(limit = 50) {
  const { data, error } = await supabase
    .from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as { id: number; actor_id: string | null; action: string; target_type: string; target_id: number | null; detail: any; created_at: string }[];
}
