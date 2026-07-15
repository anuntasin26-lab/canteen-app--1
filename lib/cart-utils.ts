// ─── lib/cart-utils.ts ────────────────────────────────────
// Pure functions ล้วน ๆ ไม่แตะ React state/network — แยกออกมาจาก
// OrderContext เพื่อให้ unit test ได้ตรง ๆ โดยไม่ต้อง mock Supabase/React

export type CartMap = Record<number, number>;

/** เพิ่มจำนวน 1 ชิ้นให้เมนู id นั้นในตะกร้า (immutable) */
export function addToCart(cart: CartMap, id: number): CartMap {
  return { ...cart, [id]: (cart[id] ?? 0) + 1 };
}

/** ลดจำนวน 1 ชิ้น — ถ้าเหลือ 0 หรือต่ำกว่า ให้เอาออกจากตะกร้าไปเลย (immutable) */
export function subFromCart(cart: CartMap, id: number): CartMap {
  const next = { ...cart, [id]: (cart[id] ?? 1) - 1 };
  if (next[id] <= 0) delete next[id];
  return next;
}

/** รวมราคาตะกร้า จาก item ที่มี price/qty */
export function cartTotal(items: { price: number; qty: number }[]): number {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

/** รวมจำนวนชิ้นทั้งหมดในตะกร้า (สำหรับ badge ตัวเลขบนไอคอนตะกร้า) */
export function cartItemCount(cart: CartMap): number {
  return Object.values(cart).reduce((sum, v) => sum + v, 0);
}

/**
 * เมนูควรแสดงให้ลูกค้าเห็นไหม — ต้องเปิดขาย (available) และยังไม่เต็มโควตาวันนี้
 * remaining_today: null/undefined = ไม่จำกัดโควตา, ตัวเลข = จำนวนที่เหลือจริง
 */
export function isMenuItemVisible(item: {
  available: boolean;
  remaining_today?: number | null;
}): boolean {
  if (!item.available) return false;
  if (item.remaining_today === null || item.remaining_today === undefined) return true;
  return item.remaining_today > 0;
}
