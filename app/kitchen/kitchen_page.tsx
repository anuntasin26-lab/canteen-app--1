"use client";
// ─── app/kitchen/page.tsx ─────────────────────────────────
// PIN lock + Kanban + ประวัติรายการ — UI ปรับใหม่ ตัวอักษรใหญ่ขึ้น

import { useEffect, useRef, useState } from "react";
import {
  getTodayOrders, getOrderHistory,
  updateOrderStatus, deleteOrder,
  subscribeToOrders, supabase,
} from "@/lib/supabase";
import type { Order } from "@/types";
import type { OrderStatus } from "@/types";

// ── PIN ──────────────────────────────────────────────────
const KITCHEN_PIN = process.env.NEXT_PUBLIC_KITCHEN_PIN ?? "1234";

// ── helpers ───────────────────────────────────────────────
const fmt = (s: string, ref?: string | null) => {
  const base = ref ? new Date(ref) : new Date(s);
  const sec = Math.floor((Date.now() - base.getTime()) / 1000);
  if (sec < 60) return `${sec}วิ`;
  return `${Math.floor(sec / 60)}น.${String(sec % 60).padStart(2, "0")}วิ`;
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("th-TH", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

const isWarn = (o: Order) => {
  const base = o.started_at ?? o.created_at;
  const sec = Math.floor((Date.now() - new Date(base).getTime()) / 1000);
  return (o.status === "new" && sec > 120) || (o.status === "cooking" && sec > 600);
};

// ── สีพื้นฐาน — เข้มขึ้นกว่าเดิมเพื่อให้ contrast ดีขึ้น ──
const C = {
  green: "#2D5409", greenL: "#E5F0D5", greenB: "#A9CF6A",
  amber: "#A8650E", amberL: "#FCEACB",
  red: "#A8281F", redL: "#FBDCDA",
  text: "#15130F", muted: "#5C5852", border: "#DEDACF", bg: "#F7F5F0",
  card: "#FFFFFF",
};

const COLS = [
  { status: "new" as OrderStatus,     label: "ใหม่",       icon: "🔔", hBg: C.redL,   hC: C.red,   cBg: "#F0B3AC", bLabel: "รับออร์เดอร์", bBg: C.red,   next: "cooking" as const },
  { status: "cooking" as OrderStatus, label: "กำลังปรุง",  icon: "👨‍🍳", hBg: C.amberL, hC: C.amber, cBg: "#F2CD8F", bLabel: "เสร็จแล้ว",   bBg: C.amber, next: "done" as const },
  { status: "done" as OrderStatus,    label: "เสิร์ฟแล้ว", icon: "✅", hBg: C.greenL, hC: C.green, cBg: C.greenB, bLabel: "ล้างรายการ",  bBg: C.green, next: null },
];

const F = "Sarabun, sans-serif";

// ─────────────────────────────────────────────────────────
export default function KitchenPage() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("kitchen_unlocked") === "1";
  });
  const [pinError, setPinError] = useState(false);
  const [tab, setTab] = useState<"kanban" | "history">("kanban");
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);
  const [hdays, setHdays] = useState(7);
  const audioRef = useRef<AudioContext | null>(null);

  const handlePin = (p: string) => {
    setPin(p);
    if (p.length === 4) {
      if (p === KITCHEN_PIN) {
        setUnlocked(true);
        setPinError(false);
        sessionStorage.setItem("kitchen_unlocked", "1");
      }
      else { setPinError(true); setTimeout(() => { setPin(""); setPinError(false); }, 800); }
    }
  };

  const handleLock = () => {
    setUnlocked(false);
    sessionStorage.removeItem("kitchen_unlocked");
  };

  useEffect(() => {
    if (!unlocked) return;
    getTodayOrders()
      .then(d => setOrders(d as Order[]))
      .finally(() => setLoading(false));
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || tab !== "history") return;
    getOrderHistory(hdays).then(d => setHistory(d as Order[]));
  }, [unlocked, tab, hdays]);

  const playTone = (freq: number, dur: number, vol = 0.4) => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch { }
  };

  // 🔔 เสียงออเดอร์ใหม่ — ดัง สูง 3 ครั้ง
  const playBeep = () => {
    playTone(880, 0.15, 0.5);
    setTimeout(() => playTone(880, 0.15, 0.5), 200);
    setTimeout(() => playTone(1100, 0.3, 0.6), 400);
  };

  // ❌ เสียงยกเลิก — ต่ำ ลงมา 2 ครั้ง
  const playAlert = () => {
    playTone(520, 0.2, 0.5);
    setTimeout(() => playTone(380, 0.4, 0.5), 250);
  };

  useEffect(() => {
    if (!unlocked) return;
    const ch = subscribeToOrders((payload) => {
      if (payload.eventType === "INSERT") {
        supabase.from("orders").select("*, departments(id,name)")
          .eq("id", payload.new.id).single()
          .then(({ data }) => {
            if (data) {
              setOrders(p => [data as Order, ...p]);
              setToast(true); setTimeout(() => setToast(false), 3000);
              playBeep();
            }
          });
      }
      if (payload.eventType === "UPDATE")
        setOrders(p => p.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
      if (payload.eventType === "DELETE")
        setOrders(p => p.filter(o => o.id !== payload.old.id));
    });
    return () => { supabase.removeChannel(ch); };
  }, [unlocked]);

  useEffect(() => {
    const t = setInterval(() => setOrders(p => [...p]), 1000);
    return () => clearInterval(t);
  }, []);

  const handleMove = async (id: number, status: "cooking" | "done") => {
    try {
      await updateOrderStatus(id, status);
      setOrders(p => p.map(o => o.id === id ? {
        ...o, status,
        started_at:   status === "cooking" ? new Date().toISOString() : o.started_at,
        completed_at: status === "done"    ? new Date().toISOString() : o.completed_at,
      } : o));
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const handleCancel = async (id: number) => {
    const confirmed = window.confirm("ยืนยันยกเลิกออเดอร์นี้?\nออเดอร์จะถูกยกเลิกและแจ้งผู้สั่งทันที");
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      setOrders(p => p.map(o => o.id === id ? { ...o, status: "cancelled" as any } : o));
      playAlert();
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  // ลบออกจาก Kanban view (ซ่อน cancelled)
  const handleClearDone = async (id: number) => {
    try {
      await deleteOrder(id);
      setOrders(p => p.filter(o => o.id !== id));
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const activeOrders = orders.filter(o => o.status !== "cancelled" as any);
  const total   = activeOrders.length;
  const pending = activeOrders.filter(o => o.status !== "done").length;
  const revenue = activeOrders.reduce((s, o) => s + o.total, 0);

  // ── PIN SCREEN ────────────────────────────────────────
  if (!unlocked) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: F, padding: 24 }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🍳</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 6 }}>หน้าครัว</div>
      <div style={{ fontSize: 15, color: C.muted, marginBottom: 36 }}>ใส่ PIN เพื่อเข้าใช้งาน</div>
      <div style={{ display: "flex", gap: 18, marginBottom: 36 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: pin.length > i ? (pinError ? C.red : C.green) : C.border, transition: "background .15s" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, maxWidth: 280, width: "100%" }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n, i) => (
          <button key={i}
            onClick={() => {
              if (n === "⌫") setPin(p => p.slice(0,-1));
              else if (n !== "") handlePin(pin + String(n));
            }}
            style={{ padding: "20px 0", border: `1.5px solid ${C.border}`, borderRadius: 14, background: n === "" ? "transparent" : C.card, fontSize: 24, fontWeight: 600, cursor: n === "" ? "default" : "pointer", color: C.text, fontFamily: F }}>
            {n}
          </button>
        ))}
      </div>
      {pinError && <div style={{ color: C.red, fontSize: 15, marginTop: 18, fontWeight: 600 }}>PIN ไม่ถูกต้อง</div>}
    </div>
  );

  // ── KITCHEN MAIN ──────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: F }}>
      {toast && (
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", padding: "12px 28px", borderRadius: "0 0 16px 16px", fontSize: 15, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap" }}>
          🔔 มีออร์เดอร์ใหม่!
        </div>
      )}

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px", background: C.card, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>🍳 ครัว</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={playBeep} style={{ padding: "8px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 24, fontSize: 13, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: F }}>🔔 ทดสอบ</button>
          <button onClick={handleLock} style={{ padding: "8px 14px", background: C.redL, border: `1px solid #ECA59D`, borderRadius: 24, fontSize: 13, fontWeight: 600, color: C.red, cursor: "pointer", fontFamily: F }}>🔒 ล็อก</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "16px 18px 10px" }}>
        {[
          { label: "ทั้งหมด", val: total,                          color: C.text },
          { label: "รอทำ",    val: pending,                        color: pending > 0 ? C.red : C.text },
          { label: "รายได้",  val: `${revenue.toLocaleString()}฿`, color: C.green },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, borderRadius: 14, padding: "14px 8px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.val}</div>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 10, padding: "8px 18px 16px" }}>
        {[["kanban","📋 ออร์เดอร์"],["history","🕐 ประวัติ"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            style={{ flex: 1, padding: "12px 0", border: `1.5px solid ${tab === t ? C.green : C.border}`, borderRadius: 14, background: tab === t ? C.greenL : C.card, color: tab === t ? C.green : C.muted, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── KANBAN (Stack แนวตั้ง อ่านง่าย) ── */}
      {tab === "kanban" && (
        <div style={{ padding: "0 14px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {COLS.map(col => {
            const colOrders = orders.filter(o => o.status === col.status && o.status !== ("cancelled" as any));
            return (
              <div key={col.status}>
                {/* Section Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, marginBottom: 10, background: col.hBg, border: `1.5px solid ${col.cBg}` }}>
                  <span style={{ fontSize: 20 }}>{col.icon}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: col.hC, flex: 1 }}>{col.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, background: col.cBg, color: col.hC, padding: "4px 14px", borderRadius: 20 }}>
                    {colOrders.length} รายการ
                  </span>
                </div>

                {colOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "18px 0", fontSize: 14, color: C.muted, border: `1.5px dashed ${C.border}`, borderRadius: 14 }}>— ไม่มีรายการ —</div>
                ) : colOrders.map(o => (
                  <div key={o.id} style={{
                    borderRadius: 16, marginBottom: 10, background: C.card, overflow: "hidden",
                    border: isWarn(o) && o.status === "new" ? `2px solid ${C.red}` : `1px solid ${C.border}`,
                    boxShadow: isWarn(o) && o.status === "new" ? `0 0 0 3px ${C.redL}` : "none",
                  }}>
                    {/* Card Header — ข้อมูลสำคัญอยู่บนสุด */}
                    <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: isWarn(o) ? C.red : C.text }}>
                          {fmt(o.created_at, o.started_at)}
                        </span>
                        {isWarn(o) && o.status === "new" && (
                          <span style={{ fontSize: 12, fontWeight: 700, background: C.red, color: "#fff", padding: "2px 8px", borderRadius: 8 }}>⚡ รีบด่วน</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, background: C.greenL, color: C.green, padding: "3px 10px", borderRadius: 10 }}>
                          {(o as any).departments?.name ?? o.dept_id}
                        </span>
                        <span style={{ fontSize: 13, color: C.muted }}>#{String(o.id).padStart(4,"0")}</span>
                      </div>
                    </div>

                    {/* Card Body — ชื่อ + เมนู */}
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>
                        👤 {o.customer_name}
                      </div>
                      {/* รายการเมนู — แต่ละรายการชัดเจน */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: o.note ? 8 : 12 }}>
                        {o.items.map((it, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: C.bg, borderRadius: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>🍽 {it.name}</span>
                            <span style={{ fontSize: 15, fontWeight: 800, color: col.hC, background: col.hBg, padding: "2px 10px", borderRadius: 8 }}>×{it.qty}</span>
                          </div>
                        ))}
                      </div>
                      {o.note && (
                        <div style={{ fontSize: 14, color: C.amber, background: C.amberL, padding: "7px 12px", borderRadius: 10, marginBottom: 12, fontWeight: 600 }}>
                          📝 หมายเหตุ: {o.note}
                        </div>
                      )}

                      {/* ปุ่มดำเนินการ */}
                      <div style={{ display: "flex", gap: 8 }}>
                        {col.next ? (
                          <button onClick={() => handleMove(o.id, col.next!)}
                            style={{ flex: 1, padding: "12px 0", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: F }}>
                            {col.bLabel} →
                          </button>
                        ) : (
                          <button onClick={() => handleClearDone(o.id)}
                            style={{ flex: 1, padding: "12px 0", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: F }}>
                            {col.bLabel}
                          </button>
                        )}
                        {col.next && (
                          <button onClick={() => handleCancel(o.id)}
                            title="ยกเลิกออเดอร์"
                            style={{ padding: "12px 16px", border: `1.5px solid #ECA59D`, background: "#FEF0EF", borderRadius: 12, cursor: "pointer", fontSize: 16, color: C.red, fontWeight: 700 }}>
                            ✕ ยกเลิก
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === "history" && (() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const todayOrders  = history.filter(o => new Date(o.created_at) >= today);
        const doneOrders   = history.filter(o => o.status === "done");
        const cancelOrders = history.filter(o => o.status === "cancelled" as any);
        const todayDone    = todayOrders.filter(o => o.status === "done");
        return (
          <div style={{ padding: "0 14px 28px" }}>
            {/* Date range selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[1,7,30].map(d => (
                <button key={d} onClick={() => setHdays(d)}
                  style={{ flex: 1, padding: "10px 0", border: `1.5px solid ${hdays === d ? C.green : C.border}`, borderRadius: 12, background: hdays === d ? C.greenL : C.card, color: hdays === d ? C.green : C.muted, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
                  {d === 1 ? "วันนี้" : `${d} วัน`}
                </button>
              ))}
            </div>

            {/* สรุปวันนี้ */}
            <div style={{ background: C.greenL, borderRadius: 16, padding: "14px 16px", marginBottom: 14, border: `1.5px solid ${C.greenB}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>📊 สรุปวันนี้</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "ทำเสร็จ",  val: todayDone.length,                            color: C.green },
                  { label: "ยกเลิก",   val: todayOrders.filter(o => o.status === ("cancelled" as any)).length, color: C.red },
                  { label: "รายได้",   val: `${todayDone.reduce((s,o) => s+o.total,0).toLocaleString()}฿`, color: C.green },
                ].map(s => (
                  <div key={s.label} style={{ background: C.card, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats รวม */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "ทั้งหมด",    val: history.length,                                      color: C.text },
                { label: "เสร็จแล้ว", val: doneOrders.length,                                   color: C.green },
                { label: "ยกเลิก",    val: cancelOrders.length,                                 color: C.red },
              ].map(s => (
                <div key={s.label} style={{ background: C.card, borderRadius: 14, padding: "12px 8px", textAlign: "center", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* รายการ */}
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 36, color: C.muted, fontSize: 15 }}>ไม่มีรายการ</div>
            ) : history.map(o => {
              const isDone   = o.status === "done";
              const isCancel = o.status === ("cancelled" as any);
              return (
                <div key={o.id} style={{ background: C.card, border: `1px solid ${isCancel ? "#FBBFBF" : C.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{o.customer_name}</span>
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>#{String(o.id).padStart(4,"0")}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700,
                      background: isDone ? C.greenL : isCancel ? C.redL : C.amberL,
                      color:      isDone ? C.green  : isCancel ? C.red   : C.amber,
                      padding: "3px 10px", borderRadius: 10 }}>
                      {isDone ? "✅ เสร็จ" : isCancel ? "❌ ยกเลิก" : "🟡 ค้าง"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                    {(o as any).departments?.name ?? o.dept_id} · {fmtDate(o.created_at)}
                  </div>
                  <div style={{ fontSize: 13, color: isCancel ? C.muted : C.text, textDecoration: isCancel ? "line-through" : "none", marginBottom: 6 }}>
                    {o.items.map(it => `${it.name} ×${it.qty}`).join(" · ")}
                  </div>
                  {!isCancel && (
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.green, textAlign: "right" }}>{o.total} บาท</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
