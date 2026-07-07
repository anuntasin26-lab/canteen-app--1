"use client";
// ─── app/kitchen/page.tsx ─────────────────────────────────
// รวม: ออเดอร์ (Kanban) + จัดการเมนู + ประวัติ — PIN เดียว
// Redesign: dark theme, delivery-app-style colored cards, big touch targets

import { useEffect, useRef, useState } from "react";
import {
  getTodayOrders, getOrderHistory,
  updateOrderStatus, deleteOrder,
  subscribeToOrders, supabase,
  getMenuItems, toggleMenuItem, updateMenuItem,
  createMenuItem, deleteMenuItem,
  createAnnouncement, subscribeToMenuItems,
  getTodayCustomOrders, updateCustomOrderStatus, cancelCustomOrder,
  subscribeToCustomOrders,
} from "@/lib/supabase";
import type { CustomOrder } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types";
import type { MenuItem } from "@/types";

// ── PIN ───────────────────────────────────────────────────
const KITCHEN_PIN = process.env.NEXT_PUBLIC_KITCHEN_PIN ?? "1234";

// ── Helpers ───────────────────────────────────────────────
const fmt = (s: string, ref?: string | null) => {
  const base = ref ? new Date(ref) : new Date(s);
  const sec = Math.floor((Date.now() - base.getTime()) / 1000);
  if (sec < 60) return `${sec}วิ`;
  return `${Math.floor(sec / 60)}น.${String(sec % 60).padStart(2, "0")}วิ`;
};
const fmtDate = (s: string) =>
  new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const isWarn = (o: Order) => {
  const base = o.started_at ?? o.created_at;
  const sec = Math.floor((Date.now() - new Date(base).getTime()) / 1000);
  return (o.status === "new" && sec > 120) || (o.status === "cooking" && sec > 600);
};

// ── สี (Dark theme, delivery-app-style accents) ────────────
const C = {
  bg:      "#101215",   // page background
  card:    "#1B1E22",   // card surface
  card2:   "#24272B",   // nested surface (item rows, inputs, chips)
  border:  "#2E3236",
  borderStrong: "#3D4247",
  text:    "#F2F1ED",
  muted:   "#9AA0A6",

  green:       "#4ADE80", // bright text/icon on dark tint
  greenBg:     "#132A1D", // dark tinted header/badge bg
  greenBorder: "#255239",
  greenSolid:  "#2D8049", // solid button fill (white text on top)

  amber:       "#FBBF5B",
  amberBg:     "#2E2412",
  amberBorder: "#4E3B18",
  amberSolid:  "#B4790F",

  red:       "#FF7A6E",
  redBg:     "#341715",
  redBorder: "#57241F",
  redSolid:  "#B4362A",
};
const F = "Sarabun, sans-serif";
const DEFAULT_CATS = ["ข้าว", "ก๋วยเตี๋ยว", "เครื่องดื่ม"];

// ── Kanban columns ────────────────────────────────────────
const COLS = [
  { status: "new" as OrderStatus,     label: "ออเดอร์ใหม่", icon: "🔔",    hBg: C.redBg,   hC: C.red,   cBg: C.redBorder,   bLabel: "เริ่มทำ",    bBg: C.redSolid,   next: "cooking" as const, accent: C.red },
  { status: "cooking" as OrderStatus, label: "กำลังทำ",     icon: "👨‍🍳", hBg: C.amberBg, hC: C.amber, cBg: C.amberBorder, bLabel: "เสร็จแล้ว",  bBg: C.amberSolid, next: "done" as const,    accent: C.amber },
  { status: "done" as OrderStatus,    label: "เสร็จแล้ว",   icon: "✅",    hBg: C.greenBg, hC: C.green, cBg: C.greenBorder, bLabel: "ล้างรายการ", bBg: C.greenSolid, next: null,               accent: C.green },
];

// ─────────────────────────────────────────────────────────
export default function KitchenPage() {
  // ── Auth ──────────────────────────────────────────────
  const [pin,       setPin]       = useState("");
  const [unlocked,  setUnlocked]  = useState(() =>
    typeof window !== "undefined" && sessionStorage.getItem("kitchen_unlocked") === "1"
  );
  const [pinError,  setPinError]  = useState(false);

  // ── Tab ───────────────────────────────────────────────
  const [tab, setTab] = useState<"kanban" | "menu" | "history">("kanban");

  // ── Orders state ──────────────────────────────────────
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [hdays,   setHdays]   = useState(1);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [toast,   setToast]   = useState(false);
  const [clearedIds, setClearedIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("kitchen_cleared_ids");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const audioRef = useRef<AudioContext | null>(null);

  // ── Custom Orders state ──────────────────────────────
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);

  // ── Menu state ────────────────────────────────────────
  const [items,      setItems]      = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuCat,    setMenuCat]    = useState("ทั้งหมด");
  const [editing,    setEditing]    = useState<number | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editPrice,  setEditPrice]  = useState("");
  const [editIng,    setEditIng]    = useState("");
  const [saving,     setSaving]     = useState<number | null>(null);
  const [menuToast,  setMenuToast]  = useState("");
  const [annText,    setAnnText]    = useState("");
  const [annSending, setAnnSending] = useState(false);
  const [showAnn,    setShowAnn]    = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newPrice,   setNewPrice]   = useState("");
  const [newCat,     setNewCat]     = useState("ข้าว");
  const [newCatCustom, setNewCatCustom] = useState(false);
  const [newCatText,   setNewCatText]   = useState("");
  const [newEmoji,   setNewEmoji]   = useState("🍽️");
  const [newIng,     setNewIng]     = useState("");
  const [adding,     setAdding]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // ── PIN handler ───────────────────────────────────────
  const handlePin = (p: string) => {
    setPin(p);
    if (p.length === 4) {
      if (p === KITCHEN_PIN) {
        setUnlocked(true); setPinError(false);
        sessionStorage.setItem("kitchen_unlocked", "1");
      } else {
        setPinError(true);
        setTimeout(() => { setPin(""); setPinError(false); }, 800);
      }
    }
  };
  const handleLock = () => { setUnlocked(false); sessionStorage.removeItem("kitchen_unlocked"); };

  // ── เสียง ─────────────────────────────────────────────
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
  const playBeep  = () => { playTone(880,0.15,0.5); setTimeout(()=>playTone(880,0.15,0.5),200); setTimeout(()=>playTone(1100,0.3,0.6),400); };
  const playAlert = () => { playTone(520,0.2,0.5); setTimeout(()=>playTone(380,0.4,0.5),250); };

  // ── Load orders ───────────────────────────────────────
  useEffect(() => {
    if (!unlocked) return;
    getTodayOrders().then(d => {
      const cleared = (() => {
        try {
          const saved = localStorage.getItem("kitchen_cleared_ids");
          return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
        } catch { return new Set<number>(); }
      })();
      setOrders((d as Order[]).filter(o => !cleared.has(o.id)));
    }).finally(() => setLoadingOrders(false));
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || tab !== "history") return;
    getOrderHistory(hdays).then(d => setHistory(d as Order[]));
  }, [unlocked, tab, hdays]);

  // ── Realtime orders ───────────────────────────────────
  useEffect(() => {
    if (!unlocked) return;
    const ch = subscribeToOrders((payload) => {
      if (payload.eventType === "INSERT") {
        supabase.from("orders").select("*, departments(id,name)").eq("id", payload.new.id).single()
          .then(({ data }) => {
            if (data) { setOrders(p => [data as Order, ...p]); setToast(true); setTimeout(() => setToast(false), 3000); playBeep(); }
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

  // ── Load custom orders ───────────────────────────────
  useEffect(() => {
    if (!unlocked) return;
    getTodayCustomOrders().then(d => {
      const cleared = (() => {
        try {
          const saved = localStorage.getItem("kitchen_cleared_ids");
          return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
        } catch { return new Set<number>(); }
      })();
      // negative ID สำหรับ custom orders
      setCustomOrders(d.filter(o => !cleared.has(-o.id)));
    });
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const ch = subscribeToCustomOrders((payload) => {
      if (payload.eventType === "INSERT") {
        setCustomOrders(p => [payload.new as CustomOrder, ...p]);
        setToast(true); setTimeout(() => setToast(false), 3000); playBeep();
      }
      if (payload.eventType === "UPDATE")
        setCustomOrders(p => p.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
      if (payload.eventType === "DELETE")
        setCustomOrders(p => p.filter(o => o.id !== payload.old.id));
    });
    return () => { supabase.removeChannel(ch); };
  }, [unlocked]);

  // ── Load menu ─────────────────────────────────────────
  useEffect(() => {
    if (!unlocked) return;
    getMenuItems().then(d => setItems(d as MenuItem[])).finally(() => setLoadingMenu(false));
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const ch = subscribeToMenuItems((payload) => {
      if (payload.eventType === "UPDATE")
        setItems(p => p.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
    });
    return () => { supabase.removeChannel(ch); };
  }, [unlocked]);

  // ── Order handlers ────────────────────────────────────
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
    if (!window.confirm("ยืนยันยกเลิกออเดอร์นี้?\nออเดอร์จะถูกยกเลิกและแจ้งผู้สั่งทันที")) return;
    try {
      const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      setOrders(p => p.map(o => o.id === id ? { ...o, status: "cancelled" as any } : o));
      playAlert();
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const handleClearDone = (id: number) => {
    setClearedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("kitchen_cleared_ids", JSON.stringify([...next]));
      return next;
    });
    setOrders(p => p.filter(o => o.id !== id));
  };

  const activeOrders = orders.filter(o => o.status !== ("cancelled" as any));
  const total   = activeOrders.length;
  const pending = activeOrders.filter(o => o.status !== "done").length;
  const revenue = activeOrders.reduce((s, o) => s + o.total, 0);

  // ── Custom Order handlers ────────────────────────────
  const handleCustomMove = async (id: number, status: "cooking" | "done") => {
    try {
      await updateCustomOrderStatus(id, status);
      setCustomOrders(p => p.map(o => o.id === id ? { ...o, status,
        started_at:   status === "cooking" ? new Date().toISOString() : o.started_at,
        completed_at: status === "done"    ? new Date().toISOString() : o.completed_at,
      } : o));
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const handleCustomCancel = async (id: number) => {
    if (!window.confirm("ยืนยันยกเลิกรายการตามสั่งนี้?")) return;
    try {
      await cancelCustomOrder(id);
      setCustomOrders(p => p.filter(o => o.id !== id));
      playAlert();
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  // ── Menu handlers ─────────────────────────────────────
  const showMenuToast = (msg: string) => { setMenuToast(msg); setTimeout(() => setMenuToast(""), 2500); };

  const handleToggle = async (item: MenuItem) => {
    setSaving(item.id);
    try {
      await toggleMenuItem(item.id, !item.available);
      setItems(p => p.map(m => m.id === item.id ? { ...m, available: !m.available } : m));
      showMenuToast(item.available ? `ปิด "${item.name}" แล้ว` : `เปิด "${item.name}" แล้ว`);
    } catch (e: any) { alert("เปิด/ปิดไม่สำเร็จ: " + (e?.message ?? "")); }
    finally { setSaving(null); }
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item.id); setEditName(item.name);
    setEditPrice(String(item.price)); setEditIng((item as any).ingredients ?? "");
  };

  const handleSave = async (item: MenuItem) => {
    const p = parseInt(editPrice);
    if (!editName.trim()) { alert("กรุณากรอกชื่อเมนู"); return; }
    if (!p || p <= 0) { alert("ราคาไม่ถูกต้อง"); return; }
    setSaving(item.id);
    try {
      await updateMenuItem(item.id, { name: editName.trim(), price: p, ingredients: editIng.trim() });
      setItems(prev => prev.map(m => m.id === item.id ? { ...m, name: editName.trim(), price: p, ingredients: editIng.trim() } as any : m));
      setEditing(null); showMenuToast(`อัปเดต "${editName.trim()}" แล้ว`);
    } catch (e: any) { alert("บันทึกไม่สำเร็จ: " + (e?.message ?? "")); }
    finally { setSaving(null); }
  };

  const handleAddMenu = async () => {
    if (!newName.trim()) { alert("กรุณากรอกชื่อเมนู"); return; }
    const p = parseInt(newPrice);
    if (!p || p <= 0) { alert("ราคาไม่ถูกต้อง"); return; }
    const finalCat = newCatCustom ? newCatText.trim() : newCat;
    if (!finalCat) { alert("กรุณาเลือกหรือพิมพ์หมวดหมู่"); return; }
    setAdding(true);
    try {
      const created = await createMenuItem({ name: newName.trim(), price: p, category: finalCat, emoji: newEmoji, ingredients: newIng.trim() });
      setItems(prev => [...prev, created as MenuItem]);
      setShowAdd(false);
      setNewName(""); setNewPrice(""); setNewIng(""); setNewEmoji("🍽️");
      setNewCatCustom(false); setNewCatText(""); setNewCat("ข้าว");
      showMenuToast(`เพิ่มเมนู "${created.name}" แล้ว`);
    } catch (e: any) { alert("เพิ่มเมนูไม่สำเร็จ: " + (e?.message ?? "")); }
    finally { setAdding(false); }
  };

  const handleDeleteMenu = async (item: MenuItem) => {
    try {
      await deleteMenuItem(item.id);
      setItems(prev => prev.filter(m => m.id !== item.id));
      setDeleteConfirm(null); showMenuToast(`ลบ "${item.name}" แล้ว`);
    } catch (e: any) { alert("ลบไม่สำเร็จ: " + (e?.message ?? "")); }
  };

  const handleAnnounce = async () => {
    if (!annText.trim()) return;
    setAnnSending(true);
    try { await createAnnouncement(annText.trim()); showMenuToast("ส่งประกาศแล้ว"); setAnnText(""); setShowAnn(false); }
    catch { alert("เกิดข้อผิดพลาด"); }
    finally { setAnnSending(false); }
  };

  const quickAnnounce = async () => {
    setAnnSending(true);
    try { await createAnnouncement("เมนูวันนี้อัปเดตแล้ว 🍽️"); showMenuToast("ส่งประกาศแล้ว"); }
    catch { alert("เกิดข้อผิดพลาด"); }
    finally { setAnnSending(false); }
  };

  const allCats = Array.from(new Set([...DEFAULT_CATS, ...items.map(m => m.category)])).sort();
  const CATS = ["ทั้งหมด", ...allCats];
  const filtered = menuCat === "ทั้งหมด" ? items : items.filter(m => m.category === menuCat);
  const availCount = items.filter(m => m.available).length;

  // ── PIN SCREEN ────────────────────────────────────────
  if (!unlocked) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: F, padding: 24 }}>
      <div style={{ width: 88, height: 88, borderRadius: 24, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, marginBottom: 20 }}>🍳</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 6 }}>หน้าครัว</div>
      <div style={{ fontSize: 15, color: C.muted, marginBottom: 36 }}>ใส่ PIN เพื่อเข้าใช้งาน</div>
      <div style={{ display: "flex", gap: 18, marginBottom: 36 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: pin.length > i ? (pinError ? C.redSolid : C.greenSolid) : C.card2, border: `1px solid ${pin.length > i ? "transparent" : C.borderStrong}`, transition: "background .15s" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, maxWidth: 300, width: "100%" }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n, i) => (
          <button key={i}
            onClick={() => {
              if (n === "⌫") setPin(p => p.slice(0,-1));
              else if (n !== "") handlePin(pin + String(n));
            }}
            style={{ padding: "22px 0", border: `1px solid ${C.border}`, borderRadius: 16, background: n === "" ? "transparent" : C.card, fontSize: 24, fontWeight: 500, cursor: n === "" ? "default" : "pointer", color: C.text, fontFamily: F }}>
            {n}
          </button>
        ))}
      </div>
      {pinError && <div style={{ color: C.red, fontSize: 15, marginTop: 18, fontWeight: 600 }}>PIN ไม่ถูกต้อง</div>}
    </div>
  );

  // ── MAIN ──────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: F }}>

      {/* Toast ออเดอร์ใหม่ */}
      {toast && (
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.greenSolid, color: "#fff", padding: "12px 28px", borderRadius: "0 0 16px 16px", fontSize: 15, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap" }}>
          🔔 มีออร์เดอร์ใหม่!
        </div>
      )}

      {/* Toast เมนู */}
      {menuToast && (
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.amberSolid, color: "#fff", padding: "12px 28px", borderRadius: "0 0 16px 16px", fontSize: 15, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap" }}>
          ✓ {menuToast}
        </div>
      )}

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: C.card, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>🍳 ครัว PETPAL</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={playBeep} style={{ padding: "8px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 24, fontSize: 12, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: F }}>🔔</button>
          <button onClick={handleLock} style={{ padding: "8px 12px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 24, fontSize: 12, fontWeight: 600, color: C.red, cursor: "pointer", fontFamily: F }}>🔒 ล็อก</button>
        </div>
      </div>

      {/* Stats — แสดงเฉพาะ tab kanban */}
      {tab === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "14px 16px 8px" }}>
          {[
            { label: "ทั้งหมด", val: total,                           color: C.text },
            { label: "รอทำ",    val: pending,                         color: pending > 0 ? C.red : C.text },
            { label: "รายได้",  val: `${revenue.toLocaleString()}฿`,  color: C.green },
          ].map(s => (
            <div key={s.label} style={{ background: C.card, borderRadius: 14, padding: "12px 8px", textAlign: "center", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Stats — แสดงเฉพาะ tab menu */}
      {tab === "menu" && (
        <div style={{ padding: "12px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: C.muted }}>เปิดใช้งาน <strong style={{ color: C.green }}>{availCount}</strong>/{items.length} รายการ</div>
        </div>
      )}

      {/* Tab bar — 3 tabs */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 14px" }}>
        {[
          ["kanban",  "📋 ออเดอร์"],
          ["menu",    "🍽️ เมนู"],
          ["history", "🕐 ประวัติ"],
        ].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            style={{ flex: 1, padding: "10px 0", border: `1px solid ${tab === t ? C.greenBorder : C.border}`, borderRadius: 14, background: tab === t ? C.greenBg : C.card, color: tab === t ? C.green : C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: KANBAN ══════════════ */}
      {tab === "kanban" && (
        <div style={{ padding: "0 14px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Section: ตามสั่ง ── */}
          {customOrders.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, marginBottom: 10, background: C.amberBg, border: `1px solid ${C.amberBorder}` }}>
                <span style={{ fontSize: 20 }}>✏️</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: C.amber, flex: 1 }}>ตามสั่ง</span>
                <span style={{ fontSize: 15, fontWeight: 700, background: C.amberBorder, color: C.amber, padding: "4px 14px", borderRadius: 20 }}>{customOrders.length} รายการ</span>
              </div>
              {customOrders.map(o => {
                const CUSTOM_COLS: Record<string, { next: "cooking"|"done"|null, bLabel: string, bBg: string, hC: string, hBg: string }> = {
                  new:     { next: "cooking", bLabel: "เริ่มทำ",     bBg: C.redSolid,   hC: C.red,   hBg: C.redBg },
                  cooking: { next: "done",    bLabel: "เสร็จแล้ว",   bBg: C.amberSolid, hC: C.amber, hBg: C.amberBg },
                  done:    { next: null,      bLabel: "ล้างรายการ",  bBg: C.greenSolid, hC: C.green, hBg: C.greenBg },
                };
                const col = CUSTOM_COLS[o.status] ?? CUSTOM_COLS.new;
                return (
                  <div key={o.id} style={{ borderRadius: 16, marginBottom: 10, background: C.card, overflow: "hidden", border: `1px solid ${C.amberBorder}`, borderLeft: `4px solid ${C.amber}` }}>
                    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, background: col.hBg, color: col.hC, padding: "2px 10px", borderRadius: 10 }}>
                          {o.status === "new" ? "🔔 ใหม่" : o.status === "cooking" ? "👨‍🍳 ปรุง" : "✅ เสร็จ"}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: C.muted }}>#{String(o.id).padStart(4,"0")}</span>
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>👤 {o.customer_name}</div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>แผนก {o.dept_id}</div>
                      {/* รายการอาหารที่พิมพ์มา */}
                      <div style={{ padding: "10px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, color: C.text, lineHeight: 1.8, marginBottom: o.note ? 8 : 12, whiteSpace: "pre-wrap" }}>
                        {o.items}
                      </div>
                      {o.note && <div style={{ fontSize: 13, color: C.amber, background: C.amberBg, padding: "6px 12px", borderRadius: 8, marginBottom: 12, fontWeight: 600 }}>📝 {o.note}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        {col.next ? (
                          <button onClick={() => handleCustomMove(o.id, col.next!)}
                            style={{ flex: 1, padding: "14px 0", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: F }}>
                            {col.bLabel} →
                          </button>
                        ) : (
                          <button onClick={() => {
                            setClearedIds(prev => {
                              const next = new Set(prev);
                              next.add(-o.id); // ใช้ negative ID เพื่อแยกจาก orders ปกติ
                              localStorage.setItem("kitchen_cleared_ids", JSON.stringify([...next]));
                              return next;
                            });
                            setCustomOrders(p => p.filter(x => x.id !== o.id));
                          }}
                            style={{ flex: 1, padding: "14px 0", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: F }}>
                            {col.bLabel}
                          </button>
                        )}
                        {col.next && (
                          <button onClick={() => handleCustomCancel(o.id)}
                            style={{ padding: "14px 16px", border: `1px solid ${C.redBorder}`, background: C.redBg, borderRadius: 12, cursor: "pointer", fontSize: 14, color: C.red, fontWeight: 700, fontFamily: F }}>
                            ✕ ยกเลิก
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Section: ออเดอร์ปกติ ── */}
          {COLS.map(col => {
            const colOrders = orders.filter(o => o.status === col.status && o.status !== ("cancelled" as any));
            return (
              <div key={col.status}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, marginBottom: 10, background: col.hBg, border: `1px solid ${col.cBg}` }}>
                  <span style={{ fontSize: 20 }}>{col.icon}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: col.hC, flex: 1 }}>{col.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, background: col.cBg, color: col.hC, padding: "4px 14px", borderRadius: 20 }}>{colOrders.length} รายการ</span>
                </div>

                {colOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "18px 0", fontSize: 14, color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 14 }}>— ไม่มีรายการ —</div>
                ) : colOrders.map(o => (
                  <div key={o.id} style={{
                    borderRadius: 16, marginBottom: 10, background: C.card, overflow: "hidden",
                    border: isWarn(o) && o.status === "new" ? `1px solid ${C.red}` : `1px solid ${C.border}`,
                    borderLeft: `4px solid ${col.accent}`,
                    boxShadow: isWarn(o) && o.status === "new" ? `0 0 0 3px ${C.redBg}` : "none",
                  }}>
                    <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: isWarn(o) ? C.red : C.text }}>{fmt(o.created_at, o.started_at)}</span>
                        {isWarn(o) && o.status === "new" && <span style={{ fontSize: 11, fontWeight: 700, background: C.redSolid, color: "#fff", padding: "2px 8px", borderRadius: 8 }}>⚡ รีบด่วน</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, background: C.greenBg, color: C.green, padding: "3px 10px", borderRadius: 10 }}>{(o as any).departments?.name ?? o.dept_id}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>#{String(o.id).padStart(4,"0")}</span>
                      </div>
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>👤 {o.customer_name}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: o.note ? 8 : 12 }}>
                        {o.items.map((it, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: C.card2, borderRadius: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>🍽 {it.name}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: col.hC, background: col.hBg, padding: "2px 10px", borderRadius: 8 }}>×{it.qty}</span>
                          </div>
                        ))}
                      </div>
                      {o.note && <div style={{ fontSize: 14, color: C.amber, background: C.amberBg, padding: "7px 12px", borderRadius: 10, marginBottom: 12, fontWeight: 600 }}>📝 {o.note}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        {col.next ? (
                          <button onClick={() => handleMove(o.id, col.next!)} style={{ flex: 1, padding: "14px 0", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: F }}>{col.bLabel} →</button>
                        ) : (
                          <button onClick={() => handleClearDone(o.id)} style={{ flex: 1, padding: "14px 0", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", background: col.bBg, color: "#fff", fontFamily: F }}>{col.bLabel}</button>
                        )}
                        {col.next && (
                          <button onClick={() => handleCancel(o.id)} style={{ padding: "14px 16px", border: `1px solid ${C.redBorder}`, background: C.redBg, borderRadius: 12, cursor: "pointer", fontSize: 14, color: C.red, fontWeight: 700, fontFamily: F }}>✕ ยกเลิก</button>
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

      {/* ══════════════ TAB: MENU ══════════════ */}
      {tab === "menu" && (
        <div>
          {/* ประกาศ */}
          <div style={{ margin: "0 16px 12px", padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.text }}>📢 ประกาศถึงลูกค้า</div>
            <button onClick={quickAnnounce} disabled={annSending}
              style={{ width: "100%", padding: "10px", background: C.greenSolid, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: annSending ? "not-allowed" : "pointer", fontFamily: F, marginBottom: 6 }}>
              {annSending ? "กำลังส่ง..." : "🔔 แจ้ง \"เมนูวันนี้อัปเดตแล้ว\""}
            </button>
            {!showAnn ? (
              <button onClick={() => setShowAnn(true)} style={{ width: "100%", padding: "8px", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: F }}>✏️ เขียนประกาศเอง</button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input value={annText} onChange={e => setAnnText(e.target.value)} placeholder="พิมพ์ข้อความประกาศ..."
                  style={{ padding: "8px 12px", background: C.card2, border: `1px solid ${C.greenBorder}`, borderRadius: 8, fontSize: 13, fontFamily: F, outline: "none", color: C.text }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleAnnounce} disabled={annSending} style={{ flex: 1, padding: "8px", background: C.greenSolid, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F }}>ส่ง</button>
                  <button onClick={() => setShowAnn(false)} style={{ flex: 1, padding: "8px", background: C.card2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: F }}>ยกเลิก</button>
                </div>
              </div>
            )}
          </div>

          {/* Category filter + ปุ่มเพิ่ม */}
          <div style={{ display: "flex", gap: 6, padding: "0 16px 10px", overflowX: "auto", scrollbarWidth: "none", alignItems: "center" }}>
            {CATS.map(c => (
              <button key={c} onClick={() => setMenuCat(c)}
                style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: menuCat === c ? "none" : `1px solid ${C.border}`, background: menuCat === c ? C.greenSolid : "transparent", color: menuCat === c ? "#fff" : C.muted, fontFamily: F }}>
                {c}
              </button>
            ))}
            <button onClick={() => setShowAdd(true)}
              style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer", border: "none", background: C.amberSolid, color: "#fff", fontFamily: F, marginLeft: "auto", flexShrink: 0 }}>
              + เพิ่มเมนู
            </button>
          </div>

          {/* Form เพิ่มเมนู */}
          {showAdd && (
            <div style={{ margin: "0 16px 12px", padding: "14px", background: C.card, border: `1px solid ${C.amberBorder}`, borderRadius: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: C.text }}>🍽️ เมนูใหม่</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🍽️" style={{ width: 50, padding: "8px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 16, textAlign: "center", fontFamily: F, color: C.text }} />
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อเมนู" style={{ flex: 1, padding: "8px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: F, color: C.text }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="ราคา" style={{ flex: 1, padding: "8px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: F, color: C.text }} />
                  {!newCatCustom ? (
                    <select value={newCat} onChange={e => { if (e.target.value === "__custom__") { setNewCatCustom(true); setNewCatText(""); } else setNewCat(e.target.value); }}
                      style={{ flex: 1, padding: "8px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: F, color: C.text }}>
                      {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="__custom__">+ หมวดใหม่...</option>
                    </select>
                  ) : (
                    <div style={{ flex: 1, display: "flex", gap: 6 }}>
                      <input value={newCatText} onChange={e => setNewCatText(e.target.value)} placeholder="พิมพ์ชื่อหมวดใหม่" autoFocus style={{ flex: 1, padding: "8px 12px", background: C.card2, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 13, fontFamily: F, color: C.text }} />
                      <button onClick={() => { setNewCatCustom(false); setNewCatText(""); }} style={{ padding: "0 10px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  )}
                </div>
                <input value={newIng} onChange={e => setNewIng(e.target.value)} placeholder="วัตถุดิบ (ถ้ามี)" style={{ padding: "8px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: F, color: C.text }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleAddMenu} disabled={adding} style={{ flex: 1, padding: "9px", background: C.amberSolid, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F }}>{adding ? "กำลังเพิ่ม..." : "เพิ่มเมนู"}</button>
                  <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "9px", background: C.card2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: F }}>ยกเลิก</button>
                </div>
              </div>
            </div>
          )}

          {/* รายการเมนู */}
          <div style={{ padding: "0 16px 28px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loadingMenu ? (
              <div style={{ textAlign: "center", padding: 32, color: C.muted }}>กำลังโหลด...</div>
            ) : filtered.map(item => (
              <div key={item.id} style={{ background: C.card, border: `1px solid ${item.available ? C.border : C.redBorder}`, borderRadius: 14, padding: "12px 14px", opacity: item.available ? 1 : 0.7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{item.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{item.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{item.price} บาท</span>
                      <button onClick={() => editing === item.id ? setEditing(null) : openEdit(item)}
                        style={{ fontSize: 11, color: C.muted, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: F }}>✏️ แก้ไข</button>
                    </div>
                    {(item as any).ingredients && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>🧂 {(item as any).ingredients}</div>}
                  </div>
                  <button onClick={() => handleToggle(item)} disabled={saving === item.id}
                    style={{ padding: "8px 14px", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: saving === item.id ? "not-allowed" : "pointer", background: item.available ? C.greenSolid : C.redBg, color: item.available ? "#fff" : C.red, flexShrink: 0, fontFamily: F, minWidth: 64 }}>
                    {saving === item.id ? "..." : item.available ? "เปิด" : "ปิด"}
                  </button>
                </div>

                {editing === item.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[["ชื่อเมนู", editName, setEditName, "text"], ["ราคา (บาท)", editPrice, setEditPrice, "number"], ["วัตถุดิบ", editIng, setEditIng, "text"]].map(([label, val, setter, type]) => (
                      <div key={label as string}>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label as string}</label>
                        <input type={type as string} value={val as string} onChange={e => (setter as any)(e.target.value)} placeholder={label === "วัตถุดิบ" ? "เช่น หมูสับ, กระเพรา" : ""}
                          style={{ width: "100%", padding: "8px 12px", background: C.card2, border: `1px solid ${C.greenBorder}`, borderRadius: 8, fontSize: 13, fontFamily: F, outline: "none", marginTop: 4, color: C.text }} />
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button onClick={() => handleSave(item)} disabled={saving === item.id} style={{ flex: 1, padding: "9px", background: C.greenSolid, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F }}>บันทึก</button>
                      <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "9px", background: C.card2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: F }}>ยกเลิก</button>
                      <button onClick={() => setDeleteConfirm(item.id)} style={{ padding: "9px 14px", background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F }}>🗑 ลบ</button>
                    </div>
                    {deleteConfirm === item.id && (
                      <div style={{ marginTop: 8, padding: "12px", background: C.redBg, borderRadius: 10, border: `1px solid ${C.redBorder}` }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 8 }}>⚠️ ลบ &quot;{item.name}&quot; ถาวร?</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleDeleteMenu(item)} style={{ flex: 1, padding: "8px", background: C.redSolid, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F }}>ยืนยันลบ</button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "8px", background: C.card, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: F }}>ไม่ลบ</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ TAB: HISTORY ══════════════ */}
      {tab === "history" && (() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const todayOrders  = history.filter(o => new Date(o.created_at) >= today);
        const doneOrders   = history.filter(o => o.status === "done");
        const cancelOrders = history.filter(o => o.status === ("cancelled" as any));
        const todayDone    = todayOrders.filter(o => o.status === "done");
        return (
          <div style={{ padding: "0 14px 28px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[1,7,30].map(d => (
                <button key={d} onClick={() => setHdays(d)}
                  style={{ flex: 1, padding: "10px 0", border: `1px solid ${hdays === d ? C.greenBorder : C.border}`, borderRadius: 12, background: hdays === d ? C.greenBg : C.card, color: hdays === d ? C.green : C.muted, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
                  {d === 1 ? "วันนี้" : `${d} วัน`}
                </button>
              ))}
            </div>

            {/* สรุปวันนี้ */}
            <div style={{ background: C.greenBg, borderRadius: 16, padding: "14px 16px", marginBottom: 14, border: `1px solid ${C.greenBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>📊 สรุปวันนี้</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "ทำเสร็จ", val: todayDone.length, color: C.green },
                  { label: "ยกเลิก",  val: todayOrders.filter(o => o.status === ("cancelled" as any)).length, color: C.red },
                  { label: "รายได้",  val: `${todayDone.reduce((s,o) => s+o.total,0).toLocaleString()}฿`, color: C.green },
                ].map(s => (
                  <div key={s.label} style={{ background: C.card, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "ทั้งหมด",    val: history.length,        color: C.text },
                { label: "เสร็จแล้ว", val: doneOrders.length,      color: C.green },
                { label: "ยกเลิก",    val: cancelOrders.length,    color: C.red },
              ].map(s => (
                <div key={s.label} style={{ background: C.card, borderRadius: 14, padding: "12px 8px", textAlign: "center", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 36, color: C.muted, fontSize: 15 }}>ไม่มีรายการ</div>
            ) : history.map(o => {
              const isDone   = o.status === "done";
              const isCancel = o.status === ("cancelled" as any);
              return (
                <div key={o.id} style={{ background: C.card, border: `1px solid ${isCancel ? C.redBorder : C.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{o.customer_name}</span>
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>#{String(o.id).padStart(4,"0")}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, background: isDone ? C.greenBg : isCancel ? C.redBg : C.amberBg, color: isDone ? C.green : isCancel ? C.red : C.amber, padding: "3px 10px", borderRadius: 10 }}>
                      {isDone ? "✅ เสร็จ" : isCancel ? "❌ ยกเลิก" : "🟡 ค้าง"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{(o as any).departments?.name ?? o.dept_id} · {fmtDate(o.created_at)}</div>
                  <div style={{ fontSize: 13, color: isCancel ? C.muted : C.text, textDecoration: isCancel ? "line-through" : "none", marginBottom: 6 }}>
                    {o.items.map(it => `${it.name} ×${it.qty}`).join(" · ")}
                  </div>
                  {!isCancel && <div style={{ fontSize: 15, fontWeight: 700, color: C.green, textAlign: "right" }}>{o.total} บาท</div>}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
