"use client";
// ─── app/history/page.tsx ─────────────────────────────────
// ประวัติการสั่งอาหารของแผนก — เข้าถึงด้วย ?dept=hr

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDeptHistory, getDepartmentById } from "@/lib/supabase";
import type { Order, Department } from "@/types";

const C = {
  green: "#3B6B0F", greenL: "#EBF3DC",
  red: "#C0392B", redL: "#FDECEA",
  amber: "#C97A14", amberL: "#FEF3DC",
  text: "#1C1A17", muted: "#7A7570", border: "#E2DDD6", bg: "#F5F3EE",
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("th-TH", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

function HistoryFlow() {
  const params  = useSearchParams();
  const deptId  = params.get("dept") ?? "";
  const [dept,    setDept]    = useState<Department | null>(null);
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [days,    setDays]    = useState(7);

  useEffect(() => {
    if (!deptId) { setLoading(false); return; }
    getDepartmentById(deptId).then(setDept).catch(() => {});
  }, [deptId]);

  useEffect(() => {
    if (!deptId) return;
    setLoading(true);
    getDeptHistory(deptId, days)
      .then(d => setOrders(d as Order[]))
      .finally(() => setLoading(false));
  }, [deptId, days]);

  const total   = orders.length;
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  if (!deptId) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Sarabun, sans-serif", color: C.muted }}>
      ไม่พบรหัสแผนก — กรุณาสแกน QR ใหม่
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "Sarabun, sans-serif" }}>
      {/* Topbar */}
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, background: "#fff", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>🕐 ประวัติการสั่ง</div>
          <div style={{ fontSize: 11, color: C.muted }}>แผนก{dept?.name ?? deptId}</div>
        </div>
        <a href={`/order?dept=${deptId}`}
          style={{ padding: "6px 12px", background: C.green, color: "#fff", borderRadius: 20, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
          + สั่งอาหาร
        </a>
      </div>

      {/* Filter days */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px" }}>
        {[3, 7, 30].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ flex: 1, padding: "7px 0", border: `1px solid ${days === d ? C.green : C.border}`, borderRadius: 10, background: days === d ? C.greenL : "#fff", color: days === d ? C.green : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            {d} วัน
          </button>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 16px 12px" }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{total}</div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase" as const }}>ออร์เดอร์ทั้งหมด</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{revenue.toLocaleString()}฿</div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase" as const }}>ยอดรวม</div>
        </div>
      </div>

      {/* Order list */}
      <div style={{ padding: "0 16px 24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: C.muted }}>กำลังโหลด...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>ไม่มีรายการในช่วงนี้</div>
        ) : orders.map(o => (
          <div key={o.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>#{String(o.id).padStart(4,"0")} · {o.customer_name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: o.status === "done" ? C.greenL : o.status === "cooking" ? C.amberL : C.redL, color: o.status === "done" ? C.green : o.status === "cooking" ? C.amber : C.red }}>
                {o.status === "done" ? "✅ เสร็จ" : o.status === "cooking" ? "👨‍🍳 กำลังทำ" : "🔔 ใหม่"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{fmtDate(o.created_at)}</div>
            {o.items.map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.text, marginBottom: 2 }}>
                <span>{it.name} ×{it.qty}</span>
                <span style={{ color: C.muted }}>{it.price * it.qty} บาท</span>
              </div>
            ))}
            {o.note && <div style={{ fontSize: 11, color: C.amber, background: C.amberL, padding: "3px 8px", borderRadius: 6, marginTop: 6 }}>📝 {o.note}</div>}
            <div style={{ textAlign: "right", marginTop: 8, fontSize: 14, fontWeight: 700, color: C.green }}>{o.total} บาท</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", fontFamily: "Sarabun, sans-serif", color: "#7A7570" }}>กำลังโหลด...</div>}>
      <HistoryFlow />
    </Suspense>
  );
}
