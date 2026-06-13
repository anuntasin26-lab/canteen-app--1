"use client";

// ─── app/kitchen/page.tsx ─────────────────────────────────
//  fix 1: ลบ `tick` state ที่ไม่ได้ใช้
//  fix 2: ลบ `prevNewCount` ref ที่ไม่ได้ใช้
//  fix 3: แก้ปุ่ม delete ซ้ำ 2 ปุ่มในคอลัมน์ "done"
// ─────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import {
  getTodayOrders,
  updateOrderStatus,
  deleteOrder,
  subscribeToOrders,
  supabase,
} from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types";

const fmtElapsed = (createdAt: string, startedAt?: string | null) => {
  const base = startedAt ? new Date(startedAt) : new Date(createdAt);
  const sec  = Math.floor((Date.now() - base.getTime()) / 1000);
  if (sec < 60) return `${sec}วิ`;
  return `${Math.floor(sec / 60)}น.${String(sec % 60).padStart(2, "0")}วิ`;
};

const isUrgent = (o: Order) => {
  const sec = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 1000);
  return o.status === "new" && sec > 180;
};

const isWarn = (o: Order) => {
  const base = o.started_at ?? o.created_at;
  const sec  = Math.floor((Date.now() - new Date(base).getTime()) / 1000);
  return (o.status === "new" && sec > 120) || (o.status === "cooking" && sec > 600);
};

// ── column config ─────────────────────────────────────────
type ColConfig = {
  status:     OrderStatus;
  label:      string;
  icon:       string;
  hdrBg:      string;
  hdrColor:   string;
  cntBg:      string;
  btnLabel:   string;
  btnBg:      string;
  nextStatus: "cooking" | "done" | null;
};

const COLS: ColConfig[] = [
  { status: "new",     label: "ออร์เดอร์ใหม่", icon: "🔔", hdrBg: "#FDECEA", hdrColor: "#7C1D13", cntBg: "#F5B4AE", btnLabel: "รับออร์เดอร์", btnBg: "#C0392B", nextStatus: "cooking" },
  { status: "cooking", label: "กำลังปรุง",      icon: "👨‍🍳", hdrBg: "#FEF3DC", hdrColor: "#7C4A08", cntBg: "#F5D49A", btnLabel: "เสร็จแล้ว",   btnBg: "#C97A14", nextStatus: "done"    },
  { status: "done",    label: "พร้อมเสิร์ฟ",    icon: "✅", hdrBg: "#EBF3DC", hdrColor: "#3B6B0F", cntBg: "#B5D47A", btnLabel: "ล้างรายการ",  btnBg: "#3B6B0F", nextStatus: null      },
];

// ─────────────────────────────────────────────────────────

export default function KitchenPage() {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  // โหลดออร์เดอร์วันนี้
  useEffect(() => {
    getTodayOrders()
      .then((data) => setOrders(data as Order[]))
      .finally(() => setLoading(false));
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = subscribeToOrders((payload) => {
      if (payload.eventType === "INSERT") {
        // ดึง departments join มาด้วย เพราะ realtime payload ไม่มี join
        supabase
          .from("orders")
          .select("*, departments(id, name)")
          .eq("id", payload.new.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setOrders((prev) => [data as Order, ...prev]);
              setToast(true);
              setTimeout(() => setToast(false), 3000);
              playBeep();
            }
          });
      }
      if (payload.eventType === "UPDATE") {
        setOrders((prev) =>
          prev.map((o) => o.id === payload.new.id ? { ...o, ...payload.new } : o)
        );
      }
      if (payload.eventType === "DELETE") {
        setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Timer: re-render ทุก 1 วินาที เพื่ออัปเดตเวลาบนการ์ด
  useEffect(() => {
    const t = setInterval(() => setOrders((prev) => [...prev]), 1000);
    return () => clearInterval(t);
  }, []);

  // เสียงแจ้งเตือน (Web Audio API)
  const playBeep = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx  = audioRef.current;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* ไม่ทำอะไรถ้า AudioContext ไม่พร้อม */ }
  };

  // เลื่อน status: new→cooking, cooking→done
  const handleMove = async (id: number, status: "cooking" | "done") => {
    try {
      await updateOrderStatus(id, status);
      // optimistic update ทันทีก่อน realtime ตอบกลับ
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status,
                started_at:   status === "cooking" ? new Date().toISOString() : o.started_at,
                completed_at: status === "done"    ? new Date().toISOString() : o.completed_at,
              }
            : o
        )
      );
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  // ลบออร์เดอร์ (ใช้กับทุกคอลัมน์ โดยมีปุ่ม 🗑 เสมอ)
  const handleDelete = async (id: number) => {
    try {
      await deleteOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  const total   = orders.length;
  const pending = orders.filter((o) => o.status !== "done").length;
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", fontFamily: "Sarabun, sans-serif", color: "#7A7570" }}>
      กำลังโหลด...
    </div>
  );

  return (
    <div style={{ fontFamily: "Sarabun, sans-serif", background: "#F5F3EE", minHeight: "100dvh" }}>

      {/* Toast แจ้งเตือนออร์เดอร์ใหม่ */}
      {toast && (
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: "#3B6B0F", color: "#fff", padding: "10px 24px", borderRadius: "0 0 14px 14px", fontSize: 13, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap" }}>
          🔔 มีออร์เดอร์ใหม่!
        </div>
      )}

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#fff", borderBottom: "1px solid #E2DDD6", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1C1A17" }}>🍳 ครัว</div>
          <div style={{ fontSize: 11, color: "#7A7570" }}>
            {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
        <button
          onClick={playBeep}
          style={{ padding: "6px 14px", background: "#F5F3EE", border: "1px solid #E2DDD6", borderRadius: 20, fontSize: 11, fontWeight: 600, color: "#7A7570", cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
        >
          🔔 ทดสอบเสียง
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 16px" }}>
        {[
          { label: "ทั้งหมด", val: total,                          color: "#1C1A17"  },
          { label: "รอทำ",    val: pending,                        color: pending > 0 ? "#C0392B" : "#1C1A17" },
          { label: "รายได้",  val: `${revenue.toLocaleString()}฿`, color: "#3B6B0F"  },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", textAlign: "center", border: "1px solid #E2DDD6" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#7A7570", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "0 16px 24px" }}>
        {COLS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status}>

              {/* Column header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 10, marginBottom: 8, background: col.hdrBg }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.hdrColor }}>{col.icon} {col.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, background: col.cntBg, color: col.hdrColor, padding: "1px 8px", borderRadius: 10 }}>{colOrders.length}</span>
              </div>

              {/* Empty state */}
              {colOrders.length === 0 && (
                <div style={{ textAlign: "center", padding: "18px 0", fontSize: 12, color: "#B0A89E", border: "1.5px dashed #E2DDD6", borderRadius: 10 }}>
                  ว่าง
                </div>
              )}

              {/* Order cards */}
              {colOrders.map((o) => {
                const warn   = isWarn(o);
                const urgent = isUrgent(o);
                return (
                  <div
                    key={o.id}
                    style={{
                      border:       urgent ? "1px solid #E2DDD6" : "1px solid #E2DDD6",
                      borderLeft:   urgent ? "3px solid #C0392B" : "1px solid #E2DDD6",
                      borderRadius: urgent ? "0 12px 12px 0"    : 12,
                      padding: "11px 13px", marginBottom: 8, background: "#fff",
                    }}
                  >
                    {/* หมายเลข + แผนก */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>#{String(o.id).padStart(4, "0")}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#EBF3DC", color: "#3B6B0F", padding: "2px 8px", borderRadius: 8 }}>
                        {(o as any).departments?.name ?? o.dept_id}
                      </span>
                    </div>

                    {/* ชื่อลูกค้า */}
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1A17", marginBottom: 5 }}>
                      {o.customer_name}
                    </div>

                    {/* รายการอาหาร */}
                    <div style={{ fontSize: 12, color: "#7A7570", marginBottom: o.note ? 6 : 8, lineHeight: 1.6 }}>
                      {o.items.map((it) => `${it.name} ×${it.qty}`).join("  ·  ")}
                    </div>

                    {/* หมายเหตุ */}
                    {o.note && (
                      <div style={{ fontSize: 11, color: "#C97A14", background: "#FEF3DC", padding: "4px 8px", borderRadius: 6, marginBottom: 8, fontWeight: 600 }}>
                        📝 {o.note}
                      </div>
                    )}

                    {/* Footer: timer + action btn + delete btn */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>

                      {/* Timer */}
                      <span style={{ fontSize: 11, fontWeight: 700, minWidth: 40, color: warn ? "#C0392B" : "#7A7570" }}>
                        {fmtElapsed(o.created_at, o.started_at)}
                      </span>

                      {/* Action button: รับ / เสร็จ / ล้าง
                          fix #3: ใช้ branch เดียว ไม่ซ้ำ
                          - new     → "รับออร์เดอร์" → handleMove(cooking)
                          - cooking → "เสร็จแล้ว"   → handleMove(done)
                          - done    → "ล้างรายการ"  → handleDelete (ปุ่มเดียว ไม่มี 🗑 ซ้ำ)
                      */}
                      {col.nextStatus !== null ? (
                        <button
                          onClick={() => handleMove(o.id, col.nextStatus!)}
                          style={{ flex: 1, padding: "6px 0", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: col.btnBg, color: "#fff", fontFamily: "Sarabun, sans-serif" }}
                        >
                          {col.btnLabel}
                        </button>
                      ) : (
                        // done column: ปุ่ม "ล้างรายการ" = delete โดยตรง ไม่ต้องมี 🗑 ซ้ำ
                        <button
                          onClick={() => handleDelete(o.id)}
                          style={{ flex: 1, padding: "6px 0", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: col.btnBg, color: "#fff", fontFamily: "Sarabun, sans-serif" }}
                        >
                          {col.btnLabel}
                        </button>
                      )}

                      {/* 🗑 delete: แสดงเฉพาะ new และ cooking (กรณีต้องการยกเลิก) */}
                      {col.nextStatus !== null && (
                        <button
                          onClick={() => handleDelete(o.id)}
                          style={{ padding: "6px 9px", border: "1px solid #E2DDD6", background: "transparent", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#7A7570" }}
                          title="ยกเลิกออร์เดอร์"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
