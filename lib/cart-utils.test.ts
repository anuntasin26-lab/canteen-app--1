import { describe, it, expect } from "vitest";
import {
  addToCart, subFromCart, cartTotal, cartItemCount, isMenuItemVisible,
} from "./cart-utils";

describe("addToCart", () => {
  it("เพิ่มเมนูใหม่เข้าตะกร้าว่าง", () => {
    expect(addToCart({}, 1)).toEqual({ 1: 1 });
  });

  it("เพิ่มจำนวนเมนูที่มีอยู่แล้ว", () => {
    expect(addToCart({ 1: 2 }, 1)).toEqual({ 1: 3 });
  });

  it("ไม่แก้ object เดิม (immutable)", () => {
    const cart = { 1: 1 };
    addToCart(cart, 1);
    expect(cart).toEqual({ 1: 1 });
  });
});

describe("subFromCart", () => {
  it("ลดจำนวนลง 1", () => {
    expect(subFromCart({ 1: 2 }, 1)).toEqual({ 1: 1 });
  });

  it("เอาออกจากตะกร้าเมื่อลดจนเหลือ 0", () => {
    expect(subFromCart({ 1: 1 }, 1)).toEqual({});
  });

  it("ไม่ทำให้ค่าติดลบเมื่อเรียกซ้ำหลังเหลือ 0", () => {
    expect(subFromCart({}, 1)).toEqual({});
  });
});

describe("cartTotal", () => {
  it("รวมราคา x จำนวนถูกต้อง", () => {
    expect(cartTotal([{ price: 40, qty: 2 }, { price: 15, qty: 1 }])).toBe(95);
  });

  it("ตะกร้าว่าง รวมเป็น 0", () => {
    expect(cartTotal([])).toBe(0);
  });
});

describe("cartItemCount", () => {
  it("รวมจำนวนชิ้นทุกเมนู", () => {
    expect(cartItemCount({ 1: 2, 2: 3 })).toBe(5);
  });

  it("ตะกร้าว่าง = 0", () => {
    expect(cartItemCount({})).toBe(0);
  });
});

describe("isMenuItemVisible", () => {
  it("ซ่อนเมนูที่ปิดขาย (available=false) แม้โควตาจะไม่จำกัด", () => {
    expect(isMenuItemVisible({ available: false, remaining_today: null })).toBe(false);
  });

  it("แสดงเมนูที่เปิดขายและไม่จำกัดโควตา", () => {
    expect(isMenuItemVisible({ available: true, remaining_today: null })).toBe(true);
  });

  it("แสดงเมนูที่เปิดขายและยังเหลือโควตา", () => {
    expect(isMenuItemVisible({ available: true, remaining_today: 3 })).toBe(true);
  });

  it("ซ่อนเมนูที่เต็มโควตาแล้ว (remaining_today = 0)", () => {
    expect(isMenuItemVisible({ available: true, remaining_today: 0 })).toBe(false);
  });

  it("undefined ถือว่าไม่จำกัดโควตาเหมือน null", () => {
    expect(isMenuItemVisible({ available: true, remaining_today: undefined })).toBe(true);
  });
});
