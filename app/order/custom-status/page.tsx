"use client";
// ─── app/order/custom-status/page.tsx ─────────────────────
// สถานะออร์เดอร์ตามสั่ง — คู่ขนานกับ /order/status ของออร์เดอร์เมนูปกติ

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "../OrderContext";
import { S } from "../styles";

const statusMeta = {
  new:       { icon: "✉️", title: "ส่งรายการให้ครัวแล้ว", sub: "รอครัวรับรายการ",       bg: "#FEF3DC" },
  cooking:   { icon: "👨‍🍳", title: "กำลังปรุงอาหาร",       sub: "ประมาณ 10–15 นาที",      bg: "#FEF3DC" },
  done:      { icon: "✅", title: "อาหารพร้อมแล้ว!",      sub: "รับที่เคาน์เตอร์ได้เลย",  bg: "#EBF3DC" },
  cancelled: { icon: "❌", title: "ยกเลิกแล้ว",           sub: "",                         bg: "#FDECEA" },
};

export default function CustomStatusPage() {
  const router = useRouter();
  const { loading, customOrder, customCancelling, handleCancelCustomOrder } = useOrder();

  useEffect(() => {
    if (!loading && !customOrder) router.replace("/order/menu");
  }, [loading, customOrder, router]);

  const cancel = async () => { await handleCancelCustomOrder(); };

  if (loading || !customOrder) return null;

  const sm = statusMeta[(customOrder.status as keyof typeof statusMeta) ?? "new"];
  const canCancel = customOrder.status === "new";

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div>
          <div style={S.title}>สถานะรายการตามสั่ง</div>
          <div style={S.sub}>#{String(customOrder.id).padStart(4, "0")} · {customOrder.customer_name}</div>
        </div>
        <span style={{ ...S.badge, background: sm.bg }}>
          {customOrder.status === "done" ? "เสร็จแล้ว" : customOrder.status === "cooking" ? "กำลังทำ" : customOrder.status === "cancelled" ? "ยกเลิก" : "ใหม่"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px 16px", gap: 8, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: sm.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 4 }}>{sm.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{sm.title}</div>
        <div style={{ fontSize: 13, color: "#7A7570" }}>{sm.sub}</div>
      </div>

      <div style={{ margin: "0 16px 16px", border: "1px solid #E2DDD6", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "#F5F3EE", fontSize: 11, fontWeight: 700, color: "#7A7570", letterSpacing: ".04em", borderBottom: "1px solid #E2DDD6" }}>รายการที่สั่ง</div>
        <div style={{ padding: "12px 14px", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{customOrder.items}</div>
        {customOrder.note && (
          <div style={{ padding: "0 14px 12px", fontSize: 12, color: "#7A7570" }}>
            หมายเหตุ: {customOrder.note}
          </div>
        )}
      </div>

      <div style={S.bottomBar}>
        <p style={{ fontSize: 11, color: "#7A7570", textAlign: "center", margin: "0 0 8px" }}>ชำระเงินที่เคาน์เตอร์หลังรับอาหาร</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => router.push("/order/custom")}
            style={{ width: "100%", padding: 12, minHeight: 48, background: "#F5F3EE", color: "#3B6B0F", border: "1px solid #B5D47A", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
          >
            สั่งตามสั่งเพิ่ม
          </button>
          {canCancel && (
            <button
              disabled={customCancelling}
              onClick={cancel}
              style={{ width: "100%", padding: 12, minHeight: 48, background: customCancelling ? "#E2DDD6" : "transparent", color: customCancelling ? "#7A7570" : "#C0392B", border: "1px solid #FBBFBF", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: customCancelling ? "not-allowed" : "pointer", fontFamily: "Sarabun, sans-serif" }}
            >
              {customCancelling ? "กำลังยกเลิก..." : "ยกเลิกรายการ"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
