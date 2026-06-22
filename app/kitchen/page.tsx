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

      {/* ── KANBAN ── */}
      {tab === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: "0 18px 28px" }}>
          {COLS.map(col => {
            const colOrders = orders.filter(o => o.status === col.status);
            return (
              <div key={col.status}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, marginBottom: 10, background: col.hBg }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: col.hC }}>{col.icon} {col.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, background: col.cBg, color: col.hC, padding: "2px 10px", borderRadius: 12 }}>{colOrders.length}</span>
                </div>
                {colOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: C.muted, border: `1.5px dashed ${C.border}`, borderRadius: 12 }}>ว่าง</div>
                ) : colOrders.map(o => (
                  <div key={o.id} style={{ border: `1px solid ${C.border}`, borderLeft: isWarn(o) && o.status === "new" ? `4px solid ${C.red}` : `1px solid ${C.border}`, borderRadius: 14, padding: "14px 14px", marginBottom: 10, background: C.card }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>#{String(o.id).padStart(4,"0")}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, background: C.greenL, color: C.green, padding: "3px 9px", borderRadius: 10 }}>
                        {(o as any).departments?.name ?? o.dept_id}
                      </span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>{o.customer_name}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: o.note ? 8 : 10, lineHeight: 1.6 }}>
                      {o.items.map(it => `${it.name} ×${it.qty}`).join(" · ")}
                    </div>
                    {o.note && <div style={{ fontSize: 13, color: C.amber, background: C.amberL, padding: "5px 10px", borderRadius: 8, marginBottom: 10, fontWeight: 600 }}>📝 {o.note}</div>}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 46, color: isWarn(o) ? C.red : C.muted }}>
                        {fmt(o.created_at, o.started_at)}
                      </span>
                      {col.next ? (
                        <button onClick={() => handleMove(o.id, col.next!)}
                          style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: F }}>
                          {col.bLabel}
                        </button>
                      ) : (
                        <button onClick={() => handleDelete(o.id)}
                          style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: F }}>
                          {col.bLabel}
                        </button>
                      )}
                      {col.next && (
                        <button onClick={() => handleDelete(o.id)}
                          style={{ padding: "9px 11px", border: `1px solid ${C.border}`, background: "transparent", borderRadius: 10, cursor: "pointer", fontSize: 14, color: C.muted }}>
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
        <div style={{ padding: "0 18px 28px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[3,7,30].map(d => (
              <button key={d} onClick={() => setHdays(d)}
                style={{ flex: 1, padding: "9px 0", border: `1.5px solid ${hdays === d ? C.green : C.border}`, borderRadius: 12, background: hdays === d ? C.greenL : C.card, color: hdays === d ? C.green : C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
                {d} วัน
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{history.length}</div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginTop: 2 }}>ออร์เดอร์ทั้งหมด</div>
            </div>
            <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>{history.reduce((s,o) => s+o.total,0).toLocaleString()}฿</div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginTop: 2 }}>รายได้รวม</div>
            </div>
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: 36, color: C.muted, fontSize: 15 }}>ไม่มีรายการ</div>
          ) : history.map(o => (
            <div key={o.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>#{String(o.id).padStart(4,"0")} · {o.customer_name}</span>
                <span style={{ fontSize: 12, background: o.status === "done" ? C.greenL : o.status === "cooking" ? C.amberL : C.redL, color: o.status === "done" ? C.green : o.status === "cooking" ? C.amber : C.red, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>
                  {o.status === "done" ? "เสร็จ" : o.status === "cooking" ? "ปรุง" : "ใหม่"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>
                {(o as any).departments?.name ?? o.dept_id} · {fmtDate(o.created_at)}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>
                {o.items.map(it => `${it.name} ×${it.qty}`).join(" · ")}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.green, textAlign: "right" }}>{o.total} บาท</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
