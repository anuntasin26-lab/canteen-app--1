"use client";
// ─── app/order/cart/page.tsx ──────────────────────────────

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "../OrderContext";
import { S } from "../styles";

export default function CartPage() {
  const router = useRouter();
  const { loading, name, cartItems, cart, add, sub, note, setNote, total, submitting, handleConfirm } = useOrder();

  useEffect(() => {
    if (loading) return;
    if (!name) { router.replace("/order/name"); return; }
    if (cartItems.length === 0) router.replace("/order/menu");
  }, [loading, name, cartItems.length, router]);

  const confirm = async () => {
    try {
      await handleConfirm();
      router.push("/order/status");
    } catch {
      // handleConfirm แสดง modal ให้แล้ว — อยู่หน้าเดิมให้แก้ไข ไม่ navigate ต่อ
    }
  };

  if (loading || !name || cartItems.length === 0) return null;

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <button onClick={() => router.push("/order/menu")} aria-label="ย้อนกลับ" style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid #E2DDD6", background: "#F5F3EE", cursor: "pointer", fontSize: 16 }}>←</button>
        <div style={S.title}>ตะกร้า</div>
        <div style={{ width: 44 }} />
      </div>
      <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {cartItems.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #E2DDD6", borderRadius: 12 }}>
            <span style={{ fontSize: 20 }}>{m.emoji}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => sub(m.id)} aria-label={`ลด ${m.name}`} style={S.qtyBtn}>−</button>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: "center" }}>{cart[m.id]}</span>
              <button onClick={() => add(m.id)} aria-label={`เพิ่ม ${m.name}`} style={S.qtyBtnFilled}>+</button>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#3B6B0F", whiteSpace: "nowrap" }}>{m.price * cart[m.id]}฿</span>
          </div>
        ))}
        <label style={{ fontSize: 12, fontWeight: 600, color: "#7A7570", letterSpacing: ".04em", textTransform: "uppercase" as const }}>หมายเหตุ (ถ้ามี)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น ไม่ใส่ผัก, เผ็ดน้อย..."
          rows={2}
          style={{ padding: "12px 14px", border: "1.5px solid #E2DDD6", borderRadius: 12, fontSize: 14, fontFamily: "Sarabun, sans-serif", background: "#F5F3EE", resize: "none" }}
        />
        <div style={{ border: "1px solid #E2DDD6", borderRadius: 12, overflow: "hidden" }}>
          {[["ชื่อผู้สั่ง", name], ["รวมทั้งหมด", `${total} บาท`]].map(([label, val], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", fontSize: i === 1 ? 14 : 13, fontWeight: i === 1 ? 700 : 400, borderBottom: i < 1 ? "1px solid #E2DDD6" : "none" }}>
              <span style={{ color: "#7A7570" }}>{label}</span>
              <span style={{ color: i === 1 ? "#3B6B0F" : "#1C1A17", fontWeight: i === 1 ? 700 : 500 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={S.bottomBar}>
        <button
          disabled={submitting}
          onClick={confirm}
          style={{ width: "100%", padding: 14, minHeight: 48, background: submitting ? "#E2DDD6" : "#3B6B0F", color: submitting ? "#7A7570" : "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "Sarabun, sans-serif" }}
        >
          {submitting ? "กำลังส่ง..." : "ยืนยันการสั่งอาหาร"}
        </button>
      </div>
    </div>
  );
}
