"use client";
// ─── app/kitchen/page.tsx ─────────────────────────────────
// Pro UI Redesign — Light & Clean, ตัวอักษรใหญ่ขึ้น, spacing ดีขึ้น
// Logic เดิมทุกอย่างยังอยู่ครบ

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

const KITCHEN_PIN = process.env.NEXT_PUBLIC_KITCHEN_PIN ?? "1234";

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

// ── Design tokens ─────────────────────────────────────────
const T = {
  // Neutrals
  white:    "#FFFFFF",
  bg:       "#F8F7F5",
  surface:  "#FFFFFF",
  border:   "#E8E4DC",
  borderMd: "#D4CEBF",
  text:     "#1A1714",
  textSub:  "#6B6560",
  textMute: "#9A9490",

  // Brand green
  green:    "#2A5208",
  greenMd:  "#3D7A0C",
  greenL:   "#EBF4DC",
  greenXL:  "#F4FAF0",
  greenB:   "#A8D470",

  // Amber
  amber:    "#96560A",
  amberL:   "#FDF0DC",
  amberB:   "#F2C96A",

  // Red
  red:      "#991B1B",
  redL:     "#FEF2F2",
  redB:     "#FBBFBF",

  // Blue (for info)
  blue:     "#1D4ED8",
  blueL:    "#EFF6FF",
};
const F = "Sarabun, sans-serif";
const DEFAULT_CATS = ["ข้าว", "ก๋วยเตี๋ยว", "เครื่องดื่ม"];

const COLS = [
  { status: "new" as OrderStatus,     label: "ออเดอร์ใหม่",  icon: "🔔", accent: T.red,   accentL: T.redL,   accentB: T.redB,   bLabel: "รับออเดอร์",  next: "cooking" as const },
  { status: "cooking" as OrderStatus, label: "กำลังปรุง",    icon: "🍳", accent: T.amber, accentL: T.amberL, accentB: T.amberB, bLabel: "เสร็จแล้ว",  next: "done" as const },
  { status: "done" as OrderStatus,    label: "เสิร์ฟแล้ว",   icon: "✅", accent: T.green, accentL: T.greenL, accentB: T.greenB, bLabel: "ล้างรายการ", next: null },
];

// ── Reusable mini components ──────────────────────────────
const Badge = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color, background: bg, fontFamily: F, whiteSpace: "nowrap" }}>
    {label}
  </span>
);

const Btn = ({ children, onClick, disabled, variant = "primary", size = "md", style: extra }: any) => {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 6, border: "none", borderRadius: 10, fontFamily: F, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
    transition: "opacity .15s",
    fontSize: size === "sm" ? 13 : size === "lg" ? 16 : 14,
    padding: size === "sm" ? "7px 14px" : size === "lg" ? "14px 20px" : "10px 16px",
  };
  const vars: Record<string, React.CSSProperties> = {
    primary:   { background: T.green,  color: "#fff" },
    secondary: { background: T.bg,     color: T.textSub, border: `1px solid ${T.border}` },
    danger:    { background: T.redL,   color: T.red,     border: `1px solid ${T.redB}` },
    dangerFill:{ background: T.red,    color: "#fff" },
    amber:     { background: T.amber,  color: "#fff" },
    amberOutline: { background: T.amberL, color: T.amber, border: `1px solid ${T.amberB}` },
    ghost:     { background: "transparent", color: T.textSub, border: `1px solid ${T.border}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...(vars[variant] || vars.primary), ...extra }}>
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────
export default function KitchenPage() {
  const [pin,       setPin]       = useState("");
  const [unlocked,  setUnlocked]  = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pinError,  setPinError]  = useState(false);
  const [tab, setTab] = useState<"kanban" | "menu" | "history">("kanban");
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [hdays,   setHdays]   = useState(1);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [toast,   setToast]   = useState(false);
  const [clearedIds, setClearedIds] = useState<Set<number>>(new Set());
  const audioRef = useRef<AudioContext | null>(null);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
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

  // ── Session check (fix hydration) ─────────────────────
  useEffect(() => {
    if (sessionStorage.getItem("kitchen_unlocked") === "1") setUnlocked(true);
    try {
      const saved = localStorage.getItem("kitchen_cleared_ids");
      if (saved) setClearedIds(new Set(JSON.parse(saved)));
    } catch { }
    setCheckingSession(false);
  }, []);

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

  useEffect(() => {
    if (!unlocked) return;
    getTodayOrders().then(d => {
      setOrders((d as Order[]).filter(o => !clearedIds.has(o.id)));
    }).finally(() => setLoadingOrders(false));
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || tab !== "history") return;
    getOrderHistory(hdays).then(d => setHistory(d as Order[]));
  }, [unlocked, tab, hdays]);

  useEffect(() => {
    if (!unlocked) return;
    const ch = subscribeToOrders((payload) => {
      if (payload.eventType === "INSERT") {
        supabase.from("orders").select("*, departments(id,name)").eq("id", payload.new.id).single()
          .then(({ data }) => {
            if (data) { setOrders(p => [data as Order, ...p]); setToast(true); setTimeout(() => setToast(false), 3500); playBeep(); }
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

  useEffect(() => {
    if (!unlocked) return;
    getTodayCustomOrders().then(d => {
      setCustomOrders(d.filter(o => !clearedIds.has(-o.id)));
    });
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const ch = subscribeToCustomOrders((payload) => {
      if (payload.eventType === "INSERT") {
        setCustomOrders(p => [payload.new as CustomOrder, ...p]);
        setToast(true); setTimeout(() => setToast(false), 3500); playBeep();
      }
      if (payload.eventType === "UPDATE")
        setCustomOrders(p => p.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
      if (payload.eventType === "DELETE")
        setCustomOrders(p => p.filter(o => o.id !== payload.old.id));
    });
    return () => { supabase.removeChannel(ch); };
  }, [unlocked]);

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

  const handleMove = async (id: number, status: "cooking" | "done") => {
    try {
      await updateOrderStatus(id, status);
      setOrders(p => p.map(o => o.id === id ? { ...o, status,
        started_at:   status === "cooking" ? new Date().toISOString() : o.started_at,
        completed_at: status === "done"    ? new Date().toISOString() : o.completed_at,
      } : o));
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm("ยืนยันยกเลิกออเดอร์นี้?")) return;
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

  // ── Checking session ──────────────────────────────────
  if (checkingSession) return <div style={{ minHeight: "100dvh", background: T.bg }} />;

  // ── PIN SCREEN ────────────────────────────────────────
  if (!unlocked) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: F, padding: 24 }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: T.greenL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, marginBottom: 20 }}>🍳</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 6 }}>หน้าครัว</div>
      <div style={{ fontSize: 15, color: T.textSub, marginBottom: 40 }}>ใส่ PIN 4 หลักเพื่อเข้าใช้งาน</div>
      <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: "50%",
            background: pin.length > i ? (pinError ? T.red : T.green) : T.border,
            transition: "background .2s",
            boxShadow: pin.length > i && !pinError ? `0 0 0 4px ${T.greenL}` : "none",
          }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, width: "100%", maxWidth: 300 }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n, i) => (
          <button key={i}
            onClick={() => {
              if (n === "⌫") setPin(p => p.slice(0,-1));
              else if (n !== "") handlePin(pin + String(n));
            }}
            style={{
              padding: "20px 0", border: `1.5px solid ${T.border}`,
              borderRadius: 16, background: n === "" ? "transparent" : T.surface,
              fontSize: 24, fontWeight: 700, cursor: n === "" ? "default" : "pointer",
              color: T.text, fontFamily: F,
              boxShadow: n !== "" ? "0 1px 3px rgba(0,0,0,.06)" : "none",
            }}>
            {n}
          </button>
        ))}
      </div>
      {pinError && (
        <div style={{ color: T.red, fontSize: 14, marginTop: 20, fontWeight: 600, background: T.redL, padding: "8px 20px", borderRadius: 10 }}>
          PIN ไม่ถูกต้อง กรุณาลองใหม่
        </div>
      )}
    </div>
  );

  // ── MAIN ──────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: T.bg, fontFamily: F }}>

      {/* Toast */}
      {(toast || menuToast) && (
        <div style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
          background: menuToast ? T.amber : T.green,
          color: "#fff", padding: "12px 28px",
          borderRadius: "0 0 16px 16px", fontSize: 15, fontWeight: 700,
          zIndex: 200, whiteSpace: "nowrap",
          boxShadow: "0 4px 20px rgba(0,0,0,.15)",
        }}>
          {menuToast ? `✓ ${menuToast}` : "🔔 มีออร์เดอร์ใหม่!"}
        </div>
      )}

      {/* ── Topbar ─────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 64,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 8px rgba(0,0,0,.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T.greenL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🍳</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>ครัว PETPAL</div>
            <div style={{ fontSize: 12, color: T.textMute }} suppressHydrationWarning>
              {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={playBeep} variant="ghost" size="sm">🔔</Btn>
          <Btn onClick={handleLock} variant="danger" size="sm">🔒 ล็อก</Btn>
        </div>
      </div>

      {/* ── Stats row (kanban) ──────────────────────────── */}
      {tab === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: "16px 20px 0" }}>
          {[
            { label: "ออเดอร์วันนี้", val: total,   color: T.text,  icon: "📋" },
            { label: "รอทำ",          val: pending,  color: pending > 0 ? T.red : T.text, icon: "⏳" },
            { label: "รายได้",         val: `${revenue.toLocaleString()}฿`, color: T.green, icon: "💰" },
          ].map(s => (
            <div key={s.label} style={{
              background: T.surface, borderRadius: 16, padding: "14px 16px",
              border: `1px solid ${T.border}`,
              boxShadow: "0 1px 4px rgba(0,0,0,.04)",
            }}>
              <div style={{ fontSize: 11, color: T.textMute, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stats row (menu) ────────────────────────────── */}
      {tab === "menu" && (
        <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, background: T.surface, borderRadius: 16, padding: "14px 16px", border: `1px solid ${T.border}`, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize: 11, color: T.textMute, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>เปิดขาย</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.green, lineHeight: 1 }}>{availCount}<span style={{ fontSize: 16, color: T.textMute, fontWeight: 600 }}>/{items.length}</span></div>
          </div>
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 0, padding: "14px 20px 0", borderBottom: `1px solid ${T.border}`, background: T.surface, position: "sticky", top: 64, zIndex: 90 }}>
        {[
          ["kanban",  "📋", "ออเดอร์"],
          ["menu",    "🍽️", "เมนู"],
          ["history", "🕐", "ประวัติ"],
        ].map(([t, icon, label]) => (
          <button key={t} onClick={() => setTab(t as any)} style={{
            flex: 1, padding: "10px 8px 12px", border: "none", background: "transparent",
            fontSize: 14, fontWeight: tab === t ? 800 : 600,
            color: tab === t ? T.green : T.textSub,
            cursor: "pointer", fontFamily: F, display: "flex",
            flexDirection: "column", alignItems: "center", gap: 2,
            borderBottom: `3px solid ${tab === t ? T.green : "transparent"}`,
            transition: "all .15s",
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: KANBAN ══════════════ */}
      {tab === "kanban" && (
        <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── Custom orders ── */}
          {customOrders.length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>✏️</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: T.amber }}>ตามสั่ง</span>
                </div>
                <Badge label={`${customOrders.length} รายการ`} color={T.amber} bg={T.amberL} />
              </div>
              {customOrders.map(o => {
                const CUSTOM_COLS: Record<string, any> = {
                  new:     { next: "cooking", bLabel: "รับออเดอร์",  accent: T.red,   accentL: T.redL },
                  cooking: { next: "done",    bLabel: "เสร็จแล้ว",  accent: T.amber, accentL: T.amberL },
                  done:    { next: null,       bLabel: "ล้างรายการ", accent: T.green, accentL: T.greenL },
                };
                const col = CUSTOM_COLS[o.status] ?? CUSTOM_COLS.new;
                return (
                  <div key={o.id} style={{
                    background: T.surface, borderRadius: 18, marginBottom: 12,
                    border: `1.5px solid ${T.amberB}`, overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(168,101,14,.08)",
                  }}>
                    <div style={{ padding: "12px 16px", background: T.amberL, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Badge label={o.status === "new" ? "🔔 ใหม่" : o.status === "cooking" ? "🍳 ปรุง" : "✅ เสร็จ"} color={T.amber} bg={T.surface} />
                      <span style={{ fontSize: 13, color: T.textSub, fontWeight: 600 }}>#{String(o.id).padStart(4,"0")} · {o.dept_id}</span>
                    </div>
                    <div style={{ padding: "16px" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 10 }}>👤 {o.customer_name}</div>
                      <div style={{ padding: "12px 14px", background: T.amberL, borderRadius: 12, fontSize: 15, color: T.text, lineHeight: 1.8, marginBottom: o.note ? 10 : 16, whiteSpace: "pre-wrap" }}>
                        {o.items}
                      </div>
                      {o.note && (
                        <div style={{ fontSize: 14, color: T.amber, background: T.amberL, padding: "8px 12px", borderRadius: 10, marginBottom: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          📝 {o.note}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10 }}>
                        {col.next ? (
                          <>
                            <button onClick={() => handleCustomMove(o.id, col.next!)} style={{
                              flex: 1, padding: "13px 0", border: "none", borderRadius: 12,
                              fontSize: 15, fontWeight: 800, cursor: "pointer",
                              background: col.accent, color: "#fff", fontFamily: F,
                            }}>{col.bLabel} →</button>
                            <button onClick={() => handleCustomCancel(o.id)} style={{
                              padding: "13px 16px", border: `1.5px solid ${T.redB}`,
                              background: T.redL, borderRadius: 12, cursor: "pointer",
                              fontSize: 14, color: T.red, fontWeight: 700, fontFamily: F,
                            }}>✕ ยกเลิก</button>
                          </>
                        ) : (
                          <button onClick={() => {
                            setClearedIds(prev => {
                              const next = new Set(prev);
                              next.add(-o.id);
                              localStorage.setItem("kitchen_cleared_ids", JSON.stringify([...next]));
                              return next;
                            });
                            setCustomOrders(p => p.filter(x => x.id !== o.id));
                          }} style={{
                            flex: 1, padding: "13px 0", border: "none", borderRadius: 12,
                            fontSize: 15, fontWeight: 800, cursor: "pointer",
                            background: T.green, color: "#fff", fontFamily: F,
                          }}>{col.bLabel}</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* ── Regular orders — per column ── */}
          {COLS.map(col => {
            const colOrders = orders.filter(o => o.status === col.status && o.status !== ("cancelled" as any));
            return (
              <section key={col.status}>
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: col.accentL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{col.icon}</div>
                    <span style={{ fontSize: 17, fontWeight: 800, color: col.accent }}>{col.label}</span>
                  </div>
                  <Badge label={`${colOrders.length} รายการ`} color={col.accent} bg={col.accentL} />
                </div>

                {colOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: T.textMute, fontSize: 14, border: `2px dashed ${T.border}`, borderRadius: 16 }}>
                    — ไม่มีรายการ —
                  </div>
                ) : colOrders.map(o => {
                  const warn = isWarn(o);
                  return (
                    <div key={o.id} style={{
                      background: T.surface, borderRadius: 18, marginBottom: 12,
                      border: warn && o.status === "new" ? `2px solid ${T.red}` : `1px solid ${T.border}`,
                      overflow: "hidden",
                      boxShadow: warn && o.status === "new"
                        ? `0 0 0 4px ${T.redL}, 0 4px 16px rgba(153,27,27,.12)`
                        : "0 1px 6px rgba(0,0,0,.05)",
                    }}>
                      {/* Card header */}
                      <div style={{
                        padding: "12px 16px", background: warn && o.status === "new" ? T.redL : col.accentL,
                        borderBottom: `1px solid ${warn && o.status === "new" ? T.redB : col.accentB}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 20, fontWeight: 800,
                            color: warn ? T.red : col.accent,
                          }} suppressHydrationWarning>{fmt(o.created_at, o.started_at)}</span>
                          {warn && o.status === "new" && (
                            <span style={{ fontSize: 11, fontWeight: 800, background: T.red, color: "#fff", padding: "2px 8px", borderRadius: 6 }}>⚡ รีบด่วน</span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Badge label={(o as any).departments?.name ?? o.dept_id} color={T.green} bg={T.greenL} />
                          <span style={{ fontSize: 12, color: T.textMute, fontWeight: 600 }}>#{String(o.id).padStart(4,"0")}</span>
                        </div>
                      </div>

                      {/* Card body */}
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 12 }}>👤 {o.customer_name}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: o.note ? 10 : 14 }}>
                          {o.items.map((it, i) => (
                            <div key={i} style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "8px 12px", background: T.bg, borderRadius: 10,
                            }}>
                              <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>🍽 {it.name}</span>
                              <span style={{
                                fontSize: 15, fontWeight: 800,
                                background: col.accentL, color: col.accent,
                                padding: "2px 12px", borderRadius: 8,
                              }}>×{it.qty}</span>
                            </div>
                          ))}
                        </div>
                        {o.note && (
                          <div style={{ fontSize: 14, color: T.amber, background: T.amberL, padding: "8px 12px", borderRadius: 10, marginBottom: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                            📝 {o.note}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10 }}>
                          {col.next ? (
                            <>
                              <button onClick={() => handleMove(o.id, col.next!)} style={{
                                flex: 1, padding: "13px 0", border: "none", borderRadius: 12,
                                fontSize: 15, fontWeight: 800, cursor: "pointer",
                                background: col.accent, color: "#fff", fontFamily: F,
                              }}>{col.bLabel} →</button>
                              <button onClick={() => handleCancel(o.id)} style={{
                                padding: "13px 16px", border: `1.5px solid ${T.redB}`,
                                background: T.redL, borderRadius: 12, cursor: "pointer",
                                fontSize: 14, color: T.red, fontWeight: 700, fontFamily: F,
                              }}>✕</button>
                            </>
                          ) : (
                            <button onClick={() => handleClearDone(o.id)} style={{
                              flex: 1, padding: "13px 0", border: "none", borderRadius: 12,
                              fontSize: 15, fontWeight: 800, cursor: "pointer",
                              background: T.green, color: "#fff", fontFamily: F,
                            }}>{col.bLabel}</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {/* ══════════════ TAB: MENU ══════════════ */}
      {tab === "menu" && (
        <div style={{ padding: "20px 20px 32px" }}>

          {/* ── ประกาศ ── */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: "16px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12 }}>📢 ประกาศถึงลูกค้า</div>
            <button onClick={quickAnnounce} disabled={annSending} style={{
              width: "100%", padding: "13px", background: T.green, color: "#fff",
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: annSending ? "not-allowed" : "pointer", fontFamily: F, marginBottom: 8,
              opacity: annSending ? 0.6 : 1,
            }}>
              {annSending ? "กำลังส่ง..." : "🔔 แจ้ง \"เมนูวันนี้อัปเดตแล้ว\""}
            </button>
            {!showAnn ? (
              <Btn onClick={() => setShowAnn(true)} variant="ghost" style={{ width: "100%" }}>✏️ เขียนประกาศเอง</Btn>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={annText} onChange={e => setAnnText(e.target.value)} placeholder="พิมพ์ข้อความประกาศ..."
                  style={{ padding: "10px 14px", border: `1.5px solid ${T.green}`, borderRadius: 10, fontSize: 14, fontFamily: F, outline: "none", color: T.text }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={handleAnnounce} disabled={annSending} variant="primary" style={{ flex: 1 }}>ส่งประกาศ</Btn>
                  <Btn onClick={() => setShowAnn(false)} variant="ghost" style={{ flex: 1 }}>ยกเลิก</Btn>
                </div>
              </div>
            )}
          </div>

          {/* ── Category filter + เพิ่มเมนู ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", overflowX: "auto", scrollbarWidth: "none" }}>
            {CATS.map(c => (
              <button key={c} onClick={() => setMenuCat(c)} style={{
                padding: "7px 16px", borderRadius: 24, fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", cursor: "pointer",
                border: menuCat === c ? "none" : `1px solid ${T.border}`,
                background: menuCat === c ? T.green : T.surface,
                color: menuCat === c ? "#fff" : T.textSub, fontFamily: F,
              }}>{c}</button>
            ))}
            <Btn onClick={() => setShowAdd(!showAdd)} variant="amber" style={{ marginLeft: "auto", flexShrink: 0 }}>
              + เพิ่มเมนู
            </Btn>
          </div>

          {/* ── Form เพิ่มเมนู ── */}
          {showAdd && (
            <div style={{ background: T.surface, border: `1.5px solid ${T.amberB}`, borderRadius: 18, padding: "16px", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 14 }}>🍽️ เพิ่มเมนูใหม่</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🍽️"
                    style={{ width: 52, padding: "10px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 18, textAlign: "center", fontFamily: F, color: T.text }} />
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อเมนู"
                    style={{ flex: 1, padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontFamily: F, color: T.text }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="ราคา (บาท)"
                    style={{ flex: 1, padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontFamily: F, color: T.text }} />
                  {!newCatCustom ? (
                    <select value={newCat} onChange={e => { if (e.target.value === "__custom__") { setNewCatCustom(true); setNewCatText(""); } else setNewCat(e.target.value); }}
                      style={{ flex: 1, padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontFamily: F, color: T.text, background: T.surface }}>
                      {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="__custom__">+ หมวดใหม่...</option>
                    </select>
                  ) : (
                    <div style={{ flex: 1, display: "flex", gap: 6 }}>
                      <input value={newCatText} onChange={e => setNewCatText(e.target.value)} placeholder="ชื่อหมวดใหม่" autoFocus
                        style={{ flex: 1, padding: "10px 14px", border: `1.5px solid ${T.amber}`, borderRadius: 10, fontSize: 14, fontFamily: F, color: T.text }} />
                      <button onClick={() => { setNewCatCustom(false); setNewCatText(""); }}
                        style={{ padding: "0 12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.textSub, cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  )}
                </div>
                <input value={newIng} onChange={e => setNewIng(e.target.value)} placeholder="วัตถุดิบ (ถ้ามี) เช่น หมูสับ, กระเพรา"
                  style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontFamily: F, color: T.text }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn onClick={handleAddMenu} disabled={adding} variant="amber" style={{ flex: 1, padding: "13px 0" }}>
                    {adding ? "กำลังเพิ่ม..." : "✓ เพิ่มเมนูนี้"}
                  </Btn>
                  <Btn onClick={() => setShowAdd(false)} variant="ghost" style={{ flex: 1, padding: "13px 0" }}>ยกเลิก</Btn>
                </div>
              </div>
            </div>
          )}

          {/* ── รายการเมนู ── */}
          {loadingMenu ? (
            <div style={{ textAlign: "center", padding: 40, color: T.textMute }}>กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: T.textMute }}>ไม่มีเมนูในหมวดนี้</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(item => (
                <div key={item.id} style={{
                  background: T.surface, border: `1px solid ${item.available ? T.border : T.redB}`,
                  borderRadius: 16, overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                  opacity: item.available ? 1 : 0.65,
                }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    {/* emoji */}
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0, border: `1px solid ${T.border}` }}>
                      {item.emoji}
                    </div>
                    {/* info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 3 }}>{item.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: T.green }}>{item.price} ฿</span>
                        <button onClick={() => editing === item.id ? setEditing(null) : openEdit(item)} style={{
                          fontSize: 12, color: T.textSub, background: T.bg,
                          border: `1px solid ${T.border}`, borderRadius: 8,
                          padding: "3px 10px", cursor: "pointer", fontFamily: F, fontWeight: 600,
                        }}>✏️ แก้ไข</button>
                      </div>
                      {(item as any).ingredients && (
                        <div style={{ fontSize: 12, color: T.textMute, marginTop: 4 }}>🧂 {(item as any).ingredients}</div>
                      )}
                    </div>
                    {/* toggle */}
                    <button onClick={() => handleToggle(item)} disabled={saving === item.id} style={{
                      padding: "10px 18px", border: "none", borderRadius: 12,
                      fontSize: 14, fontWeight: 800,
                      cursor: saving === item.id ? "not-allowed" : "pointer",
                      background: item.available ? T.green : T.redL,
                      color: item.available ? "#fff" : T.red,
                      flexShrink: 0, fontFamily: F, minWidth: 72,
                      transition: "all .15s",
                    }}>
                      {saving === item.id ? "..." : item.available ? "เปิด" : "ปิด"}
                    </button>
                  </div>

                  {/* Edit form */}
                  {editing === item.id && (
                    <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[
                          { label: "ชื่อเมนู", val: editName, set: setEditName, type: "text" },
                          { label: "ราคา (บาท)", val: editPrice, set: setEditPrice, type: "number" },
                          { label: "วัตถุดิบ", val: editIng, set: setEditIng, type: "text" },
                        ].map(f => (
                          <div key={f.label}>
                            <label style={{ fontSize: 12, color: T.textMute, fontWeight: 700, display: "block", marginBottom: 4 }}>{f.label}</label>
                            <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)}
                              placeholder={f.label === "วัตถุดิบ" ? "เช่น หมูสับ, กระเพรา" : ""}
                              style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${T.green}`, borderRadius: 10, fontSize: 14, fontFamily: F, outline: "none", color: T.text, boxSizing: "border-box" }} />
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <Btn onClick={() => handleSave(item)} disabled={saving === item.id} variant="primary" style={{ flex: 1 }}>✓ บันทึก</Btn>
                          <Btn onClick={() => setEditing(null)} variant="ghost" style={{ flex: 1 }}>ยกเลิก</Btn>
                          <Btn onClick={() => setDeleteConfirm(item.id)} variant="danger">🗑</Btn>
                        </div>
                        {deleteConfirm === item.id && (
                          <div style={{ background: T.redL, border: `1px solid ${T.redB}`, borderRadius: 12, padding: "14px" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.red, marginBottom: 10 }}>⚠️ ลบ &quot;{item.name}&quot; ถาวร?</div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <Btn onClick={() => handleDeleteMenu(item)} variant="dangerFill" style={{ flex: 1 }}>ยืนยันลบ</Btn>
                              <Btn onClick={() => setDeleteConfirm(null)} variant="ghost" style={{ flex: 1 }}>ไม่ลบ</Btn>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
          <div style={{ padding: "20px 20px 32px" }}>
            {/* Filter */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {[1,7,30].map(d => (
                <button key={d} onClick={() => setHdays(d)} style={{
                  flex: 1, padding: "12px 0", border: `2px solid ${hdays === d ? T.green : T.border}`,
                  borderRadius: 14, background: hdays === d ? T.greenL : T.surface,
                  color: hdays === d ? T.green : T.textSub, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: F,
                }}>
                  {d === 1 ? "วันนี้" : `${d} วัน`}
                </button>
              ))}
            </div>

            {/* Summary card */}
            <div style={{ background: T.greenXL, border: `1.5px solid ${T.greenB}`, borderRadius: 18, padding: "16px", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.green, marginBottom: 12 }}>📊 สรุปวันนี้</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "ทำเสร็จ", val: todayDone.length, color: T.green },
                  { label: "ยกเลิก",  val: todayOrders.filter(o => o.status === ("cancelled" as any)).length, color: T.red },
                  { label: "รายได้",  val: `${todayDone.reduce((s,o) => s+o.total,0).toLocaleString()}฿`, color: T.green },
                ].map(s => (
                  <div key={s.label} style={{ background: T.surface, borderRadius: 12, padding: "12px 10px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: T.textMute, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "ทั้งหมด",   val: history.length,     color: T.text },
                { label: "เสร็จ",     val: doneOrders.length,  color: T.green },
                { label: "ยกเลิก",   val: cancelOrders.length, color: T.red },
              ].map(s => (
                <div key={s.label} style={{ background: T.surface, borderRadius: 14, padding: "14px 10px", textAlign: "center", border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: T.textMute, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Order list */}
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: T.textMute, fontSize: 15 }}>ไม่มีรายการ</div>
            ) : history.map(o => {
              const isDone   = o.status === "done";
              const isCancel = o.status === ("cancelled" as any);
              return (
                <div key={o.id} style={{
                  background: T.surface, border: `1px solid ${isCancel ? T.redB : T.border}`,
                  borderRadius: 16, padding: "14px 16px", marginBottom: 10,
                  boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: isCancel ? T.textSub : T.text }}>{o.customer_name}</span>
                      <span style={{ fontSize: 13, color: T.textMute, marginLeft: 8 }}>#{String(o.id).padStart(4,"0")}</span>
                    </div>
                    <Badge
                      label={isDone ? "✅ เสร็จ" : isCancel ? "❌ ยกเลิก" : "🟡 ค้าง"}
                      color={isDone ? T.green : isCancel ? T.red : T.amber}
                      bg={isDone ? T.greenL : isCancel ? T.redL : T.amberL}
                    />
                  </div>
                  <div style={{ fontSize: 13, color: T.textMute, marginBottom: 6 }}>
                    {(o as any).departments?.name ?? o.dept_id} · {fmtDate(o.created_at)}
                  </div>
                  <div style={{ fontSize: 14, color: isCancel ? T.textMute : T.text, textDecoration: isCancel ? "line-through" : "none", marginBottom: isDone ? 8 : 0 }}>
                    {o.items.map(it => `${it.name} ×${it.qty}`).join("  ·  ")}
                  </div>
                  {isDone && (
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.green, textAlign: "right" }}>{o.total} บาท</div>
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
