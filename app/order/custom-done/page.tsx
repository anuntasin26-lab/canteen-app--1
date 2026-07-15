"use client";
// ─── app/order/custom-done/page.tsx ───────────────────────

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "../OrderContext";
import { S } from "../styles";

export default function CustomDonePage() {
  const router = useRouter();
  const { loading, name } = useOrder();

  useEffect(() => {
    if (!loading && !name) router.replace("/order/name");
  }, [loading, name, router]);

  if (loading || !name) return null;

  return (
    <div style={S.app}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 16, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#FEF3DC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>✉️</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1A17" }}>ส่งรายการให้ครัวแล้ว!</div>
        <div style={{ fontSize: 14, color: "#7A7570" }}>ครัวจะรับทราบรายการของคุณในไม่ช้า</div>
        <div style={{ padding: "12px 20px", background: "#F5F3EE", borderRadius: 14, fontSize: 13, color: "#5C5852", textAlign: "left", width: "100%", lineHeight: 1.8 }}>
          👤 {name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          <button onClick={() => router.push("/order/custom")}
            style={{ width: "100%", padding: 13, minHeight: 48, background: "#A8650E", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            ✏️ สั่งเพิ่มอีก
          </button>
          <button onClick={() => router.push("/order/menu")}
            style={{ width: "100%", padding: 13, minHeight: 48, background: "#F5F3EE", color: "#3B6B0F", border: "1px solid #B5D47A", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            กลับหน้าเมนู
          </button>
        </div>
      </div>
    </div>
  );
}
