"use client";
// ─── app/order/custom/page.tsx ────────────────────────────

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "../OrderContext";
import { S } from "../styles";

export default function CustomOrderPage() {
  const router = useRouter();
  const { loading, name, customItems, setCustomItems, customNote, setCustomNote, customSubmitting, handleCustomSubmit } = useOrder();

  useEffect(() => {
    if (!loading && !name) router.replace("/order/name");
  }, [loading, name, router]);

  const submit = async () => {
    try {
      await handleCustomSubmit();
      router.push("/order/custom-done");
    } catch {
      // modal แสดงให้แล้ว — อยู่หน้าเดิมให้แก้ไข
    }
  };

  if (loading || !name) return null;

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <button onClick={() => router.push("/order/menu")} aria-label="ย้อนกลับ" style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid #E2DDD6", background: "#F5F3EE", cursor: "pointer", fontSize: 16 }}>←</button>
        <div>
          <div style={S.title}>สั่งตามสั่ง</div>
          <div style={S.sub}>{name}</div>
        </div>
        <div style={{ width: 44 }} />
      </div>
      <div style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ padding: "14px 16px", background: "#FEF3DC", borderRadius: 14, fontSize: 13, color: "#A8650E", fontWeight: 600 }}>
          ✏️ พิมพ์รายการอาหารที่ต้องการ เช่น &quot;ข้าวผัดกระเพราหมูสับไข่ดาว&quot;
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#7A7570", letterSpacing: ".04em" }}>รายการอาหาร *</label>
          <textarea
            value={customItems}
            onChange={(e) => setCustomItems(e.target.value)}
            placeholder={"เช่น ข้าวผัดกระเพราหมูสับไข่ดาว\nต้มยำกุ้งน้ำข้น 1 ที่\nน้ำเปล่า 1 ขวด"}
            rows={5}
            autoFocus
            style={{ padding: "12px 14px", border: "1.5px solid #F2CD8F", borderRadius: 12, fontSize: 14, fontFamily: "Sarabun, sans-serif", background: "#FFFDF5", resize: "none", lineHeight: 1.7 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#7A7570", letterSpacing: ".04em" }}>หมายเหตุ (ถ้ามี)</label>
          <input
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="เช่น ไม่เผ็ด, แยกน้ำ"
            style={{ padding: "12px 14px", border: "1.5px solid #E2DDD6", borderRadius: 12, fontSize: 14, fontFamily: "Sarabun, sans-serif", background: "#F5F3EE" }}
          />
        </div>
        <div style={{ border: "1px solid #E2DDD6", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", fontSize: 13 }}>
            <span style={{ color: "#7A7570" }}>ชื่อผู้สั่ง</span>
            <span style={{ color: "#1C1A17", fontWeight: 500 }}>{name}</span>
          </div>
        </div>
      </div>
      <div style={S.bottomBar}>
        <button
          disabled={!customItems.trim() || customSubmitting}
          onClick={submit}
          style={{ width: "100%", padding: 14, minHeight: 48, background: customItems.trim() ? "#A8650E" : "#E2DDD6", color: customItems.trim() ? "#fff" : "#7A7570", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: customItems.trim() ? "pointer" : "not-allowed", fontFamily: "Sarabun, sans-serif" }}>
          {customSubmitting ? "กำลังส่ง..." : "✉️ ส่งรายการให้ครัว"}
        </button>
      </div>
    </div>
  );
}
