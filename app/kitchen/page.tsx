"use client";
// ─── app/kitchen/page.tsx ─────────────────────────────────
// PIN lock + Kanban + ประวัติรายการ

import { useEffect, useRef, useState } from "react";
import {
  getTodayOrders, getOrderHistory,
  updateOrderStatus, deleteOrder,
  subscribeToOrders, supabase,
} from "@/lib/supabase";
import type { Order } from "@/types";
import type { OrderStatus } from "@/types";

// ── PIN ──────────────────────────────────────────────────
const KITCHEN_PIN = process.env.NEXT_PUBLIC_KITCHEN_PIN ?? "1234"; // เปลี่ยนได้ตามต้องการ

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

const C = {
  green: "#3B6B0F", greenL: "#EBF3DC", greenB: "#B5D47A",
  amber: "#C97A14", amberL: "#FEF3DC",
  red: "#C0392B", redL: "#FDECEA",
  text: "#1C1A17", muted: "#7A7570", border: "#E2DDD6", bg: "#F5F3EE",
};

const COLS = [
  { status: "new" as OrderStatus,     label: "ใหม่",        icon: "🔔", hBg: C.redL,   hC: "#7C1D13", cBg: "#F5B4AE", bLabel: "รับออร์เดอร์", bBg: C.red,   next: "cooking" as const },
  { status: "cooking" as OrderStatus, label: "กำลังปรุง",   icon: "👨‍🍳", hBg: C.amberL, hC: "#7C4A08", cBg: "#F5D49A", bLabel: "เสร็จแล้ว",   bBg: C.amber, next: "done" as const },
  { status: "done" as OrderStatus,    label: "เสิร์ฟแล้ว",  icon: "✅", hBg: C.greenL, hC: C.green,  cBg: C.greenB, bLabel: "ล้างรายการ",  bBg: C.green, next: null },
];

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

  // ── PIN check ─────────────────────────────────────────
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

  // ── load orders ───────────────────────────────────────
  useEffect(() => {
    if (!unlocked) return;
    getTodayOrders()
      .then(d => setOrders(d as Order[]))
      .finally(() => setLoading(false));
  }, [unlocked]);

  // ── load history ──────────────────────────────────────
  useEffect(() => {
    if (!unlocked || tab !== "history") return;
    getOrderHistory(hdays).then(d => setHistory(d as Order[]));
  }, [unlocked, tab, hdays]);

  const playBeep = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch { }
  };

  // ── realtime ──────────────────────────────────────────
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

  // ── timer tick ────────────────────────────────────────
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

  const handleDelete = async (id: number) => {
    try {
      await deleteOrder(id);
      setOrders(p => p.filter(o => o.id !== id));
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const total   = orders.length;
  const pending = orders.filter(o => o.status !== "done").length;
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  // ── PIN SCREEN ────────────────────────────────────────
  if (!unlocked) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "Sarabun, sans-serif", padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🍳</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>หน้าครัว</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 32 }}>ใส่ PIN เพื่อเข้าใช้งาน</div>

      {/* PIN dots */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: pin.length > i ? (pinError ? C.red : C.green) : C.border, transition: "background .15s" }} />
        ))}
      </div>

      {/* Numpad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 240, width: "100%" }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n, i) => (
          <button key={i}
            onClick={() => {
              if (n === "⌫") setPin(p => p.slice(0,-1));
              else if (n !== "") handlePin(pin + String(n));
            }}
            style={{ padding: "18px 0", border: `1px solid ${C.border}`, borderRadius: 12, background: n === "" ? "transparent" : "#fff", fontSize: 20, fontWeight: 600, cursor: n === "" ? "default" : "pointer", color: C.text, fontFamily: "Sarabun, sans-serif" }}
          >
            {n}
          </button>
        ))}
      </div>
      {pinError && <div style={{ color: C.red, fontSize: 13, marginTop: 16, fontWeight: 600 }}>PIN ไม่ถูกต้อง</div>}
    </div>
  );

  // ── KITCHEN MAIN ──────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "Sarabun, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", padding: "10px 24px", borderRadius: "0 0 14px 14px", fontSize: 13, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap" }}>
          🔔 มีออร์เดอร์ใหม่!
        </div>
      )}

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#fff", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>🍳 ครัว</div>
          <div style={{ fontSize: 11, color: C.muted }}>{new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={playBeep} style={{ padding: "5px 10px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 11, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>🔔 ทดสอบ</button>
          <button onClick={handleLock} style={{ padding: "5px 10px", background: C.redL, border: `1px solid #F5B4AE`, borderRadius: 20, fontSize: 11, fontWeight: 600, color: C.red, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>🔒 ล็อก</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 16px" }}>
        {[
          { label: "ทั้งหมด", val: total,                          color: C.text },
          { label: "รอทำ",    val: pending,                        color: pending > 0 ? C.red : C.text },
          { label: "รายได้",  val: `${revenue.toLocaleString()}฿`, color: C.green },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, padding: "0 16px 12px" }}>
        {[["kanban","📋 ออร์เดอร์"],["history","🕐 ประวัติ"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            style={{ flex: 1, padding: "8px 0", border: `1px solid ${tab === t ? C.green : C.border}`, borderRadius: 10, background: tab === t ? C.greenL : "#fff", color: tab === t ? C.green : C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── KANBAN ── */}
      {tab === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "0 16px 24px" }}>
          {COLS.map(col => {
            const colOrders = orders.filter(o => o.status === col.status);
            return (
              <div key={col.status}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 10, marginBottom: 8, background: col.hBg }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.hC }}>{col.icon} {col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: col.cBg, color: col.hC, padding: "1px 8px", borderRadius: 10 }}>{colOrders.length}</span>
                </div>
                {colOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: "#B0A89E", border: `1.5px dashed ${C.border}`, borderRadius: 10 }}>ว่าง</div>
                ) : colOrders.map(o => (
                  <div key={o.id} style={{ border: `1px solid ${C.border}`, borderLeft: isWarn(o) && o.status === "new" ? `3px solid ${C.red}` : `1px solid ${C.border}`, borderRadius: 12, padding: "11px 12px", marginBottom: 8, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>#{String(o.id).padStart(4,"0")}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: C.greenL, color: C.green, padding: "2px 7px", borderRadius: 8 }}>
                        {(o as any).departments?.name ?? o.dept_id}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{o.customer_name}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: o.note ? 6 : 8, lineHeight: 1.6 }}>
                      {o.items.map(it => `${it.name} ×${it.qty}`).join(" · ")}
                    </div>
                    {o.note && <div style={{ fontSize: 11, color: C.amber, background: C.amberL, padding: "3px 8px", borderRadius: 6, marginBottom: 8, fontWeight: 600 }}>📝 {o.note}</div>}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, minWidth: 38, color: isWarn(o) ? C.red : C.muted }}>
                        {fmt(o.created_at, o.started_at)}
                      </span>
                      {col.next ? (
                        <button onClick={() => handleMove(o.id, col.next!)}
                          style={{ flex: 1, padding: "6px 0", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: "Sarabun, sans-serif" }}>
                          {col.bLabel}
                        </button>
                      ) : (
                        <button onClick={() => handleDelete(o.id)}
                          style={{ flex: 1, padding: "6px 0", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: "Sarabun, sans-serif" }}>
                          {col.bLabel}
                        </button>
                      )}
                      {col.next && (
                        <button onClick={() => handleDelete(o.id)}
                          style={{ padding: "6px 8px", border: `1px solid ${C.border}`, background: "transparent", borderRadius: 8, cursor: "pointer", fontSize: 12, color: C.muted }}>
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === "history" && (
        <div style={{ padding: "0 16px 24px" }}>
          {/* filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[3,7,30].map(d => (
              <button key={d} onClick={() => setHdays(d)}
                style={{ flex: 1, padding: "7px 0", border: `1px solid ${hdays === d ? C.green : C.border}`, borderRadius: 10, background: hdays === d ? C.greenL : "#fff", color: hdays === d ? C.green : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                {d} วัน
              </button>
            ))}
          </div>

          {/* summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{history.length}</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>ออร์เดอร์ทั้งหมด</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{history.reduce((s,o) => s+o.total,0).toLocaleString()}฿</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>รายได้รวม</div>
            </div>
          </div>

          {/* list */}
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>ไม่มีรายการ</div>
          ) : history.map(o => (
            <div key={o.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>#{String(o.id).padStart(4,"0")} · {o.customer_name}</span>
                <span style={{ fontSize: 10, background: o.status === "done" ? C.greenL : o.status === "cooking" ? C.amberL : C.redL, color: o.status === "done" ? C.green : o.status === "cooking" ? C.amber : C.red, padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
                  {o.status === "done" ? "เสร็จ" : o.status === "cooking" ? "ปรุง" : "ใหม่"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                {(o as any).departments?.name ?? o.dept_id} · {fmtDate(o.created_at)}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                {o.items.map(it => `${it.name} ×${it.qty}`).join(" · ")}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, textAlign: "right" }}>{o.total} บาท</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
