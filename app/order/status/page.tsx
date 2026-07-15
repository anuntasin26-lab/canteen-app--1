"use client";
// ─── app/order/status/page.tsx ────────────────────────────

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "../OrderContext";
import { S } from "../styles";

const statusMeta = {
  new:       { icon: "📋", title: "ออร์เดอร์ถูกส่งแล้ว", sub: "รอร้านรับออร์เดอร์",     bg: "#EEF2FF" },
  cooking:   { icon: "👨‍🍳", title: "กำลังปรุงอาหาร",     sub: "ประมาณ 10–15 นาที",      bg: "#FEF3DC" },
  done:      { icon: "✅", title: "อาหารพร้อมแล้ว!",    sub: "รับที่เคาน์เตอร์ได้เลย",  bg: "#EBF3DC" },
  cancelled: { icon: "❌", title: "ยกเลิกแล้ว",         sub: "",                         bg: "#FDECEA" },
};

export default function StatusPage() {
  const router = useRouter();
  const {
    loading, order, editingName, setEditingName, newName, setNewName, savingName,
    handleSaveName, cancelling, handleCancel, handleReorder,
  } = useOrder();

  // ── redirect guard: ไม่มีออเดอร์ (ยังไม่เคยสั่ง หรือเพิ่งยกเลิกไป) ──
  useEffect(() => {
    if (!loading && !order) router.replace("/order/menu");
  }, [loading, order, router]);

  const reorder = () => { handleReorder(); router.push("/order/menu"); };
  const cancel = async () => { await handleCancel(); }; // guard effect ข้างบนจะพาไป /order/menu เองถ้าสำเร็จ

  if (loading || !order) return null;

  const sm = statusMeta[(order.status as keyof typeof statusMeta) ?? "new"];
  const canCancel   = order.status === "new";
  const canEditName = order.status === "new" || order.status === "cooking";

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div>
          <div style={S.title}>สถานะออร์เดอร์</div>
          <div style={S.sub}>#{String(order.id).padStart(4, "0")} · {order.customer_name}</div>
        </div>
        <span style={{ ...S.badge, background: sm.bg }}>
          {order.status === "done" ? "เสร็จแล้ว" : order.status === "cooking" ? "กำลังทำ" : order.status === "cancelled" ? "ยกเลิก" : "ใหม่"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px 16px", gap: 8, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: sm.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 4 }}>{sm.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{sm.title}</div>
        <div style={{ fontSize: 13, color: "#7A7570" }}>{sm.sub}</div>
      </div>

      {canEditName && (
        <div style={{ margin: "0 16px 12px", padding: "12px 14px", border: "1px solid #E2DDD6", borderRadius: 12, background: "#F5F3EE" }}>
          {editingName ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#7A7570" }}>แก้ไขชื่อ</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={order.customer_name}
                autoFocus
                style={{ padding: "10px 12px", border: "1.5px solid #E2DDD6", borderRadius: 10, fontSize: 14, fontFamily: "Sarabun, sans-serif", background: "#fff" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setEditingName(false)}
                  style={{ flex: 1, padding: 10, minHeight: 44, background: "transparent", color: "#7A7570", border: "1px solid #E2DDD6", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
                >
                  ยกเลิก
                </button>
                <button
                  disabled={!newName.trim() || savingName}
                  onClick={handleSaveName}
                  style={{ flex: 1, padding: 10, minHeight: 44, background: newName.trim() ? "#3B6B0F" : "#E2DDD6", color: newName.trim() ? "#fff" : "#7A7570", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: newName.trim() ? "pointer" : "not-allowed", fontFamily: "Sarabun, sans-serif" }}
                >
                  {savingName ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#7A7570", marginBottom: 2 }}>ชื่อผู้สั่ง</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{order.customer_name}</div>
              </div>
              <button
                onClick={() => { setNewName(order.customer_name); setEditingName(true); }}
                style={{ padding: "6px 14px", minHeight: 36, background: "transparent", color: "#3B6B0F", border: "1px solid #B5D47A", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
              >
                ✏️ แก้ไข
              </button>
            </div>
          )}
        </div>
      )}

      {order.status !== "cancelled" && (
        <div style={{ padding: "0 28px 16px" }}>
          {(["new", "cooking", "done"] as const).map((s, i, arr) => {
            const pastDone = (order.status === "cooking" && i === 0) || order.status === "done";
            const isFirst  = i === 0;
            const isActive = order.status === s;
            const labels   = ["ส่งออร์เดอร์แล้ว", "กำลังปรุงอาหาร", "พร้อมเสิร์ฟ"];
            return (
              <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: pastDone || isFirst ? "#3B6B0F" : isActive ? "#FEF3DC" : "#F5F3EE", border: isActive && !isFirst ? "2px solid #C97A14" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: pastDone || isFirst ? "#fff" : isActive ? "#C97A14" : "#7A7570" }}>
                    {pastDone || isFirst ? "✓" : i + 1}
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 2, height: 20, background: pastDone || isFirst ? "#B5D47A" : "#E2DDD6", margin: "2px 0" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isActive || pastDone || isFirst ? "#1C1A17" : "#7A7570" }}>{labels[i]}</div>
                  <div style={{ fontSize: 11, color: "#7A7570", marginBottom: 14 }}>
                    {pastDone || isFirst ? "เสร็จสิ้น" : isActive ? "กำลังดำเนินการ" : "รอดำเนินการ"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ margin: "0 16px 16px", border: "1px solid #E2DDD6", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "#F5F3EE", fontSize: 11, fontWeight: 700, color: "#7A7570", letterSpacing: ".04em", borderBottom: "1px solid #E2DDD6" }}>รายการที่สั่ง</div>
        {order.items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #E2DDD6" }}>
            <span>{it.name} ×{it.qty}</span>
            <span style={{ color: "#3B6B0F", fontWeight: 700 }}>{it.price * it.qty} บาท</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", fontSize: 14, fontWeight: 700 }}>
          <span style={{ color: "#7A7570" }}>รวม</span>
          <span style={{ color: "#3B6B0F" }}>{order.total} บาท</span>
        </div>
      </div>

      <div style={S.bottomBar}>
        <p style={{ fontSize: 11, color: "#7A7570", textAlign: "center", margin: "0 0 8px" }}>ชำระเงินที่เคาน์เตอร์หลังรับอาหาร</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={reorder}
            style={{ width: "100%", padding: 12, minHeight: 48, background: "#F5F3EE", color: "#3B6B0F", border: "1px solid #B5D47A", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
          >
            สั่งอาหารเพิ่ม
          </button>
          {canCancel && (
            <button
              disabled={cancelling}
              onClick={cancel}
              style={{ width: "100%", padding: 12, minHeight: 48, background: cancelling ? "#E2DDD6" : "transparent", color: cancelling ? "#7A7570" : "#C0392B", border: "1px solid #FBBFBF", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: cancelling ? "not-allowed" : "pointer", fontFamily: "Sarabun, sans-serif" }}
            >
              {cancelling ? "กำลังยกเลิก..." : "ยกเลิกออเดอร์"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
