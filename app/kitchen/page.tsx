"use client";
// ─── app/kitchen/page.tsx ─────────────────────────────────
// รวม: ออเดอร์ (Clipboard tickets) + จัดการเมนู + ประวัติ — login ด้วย Supabase Auth
// Redesign: "prep clipboard" paper theme — เอกสารกระดาษ/ใบสั่งครัว

import { useEffect, useRef, useState } from "react";
import {
  getTodayOrders, getOrderHistory,
  updateOrderStatus,
  subscribeToOrders, supabase,
  getMenuItems, toggleMenuItem, updateMenuItem,
  createMenuItem, deleteMenuItem,
  createAnnouncement, subscribeToMenuItems,
  getTodayCustomOrders, updateCustomOrderStatus, cancelCustomOrder,
  subscribeToCustomOrders,
  uploadMenuImage, deleteMenuImage,
  signInStaff, signOutStaff,
  flagOrderName,
} from "@/lib/supabase";
import type { CustomOrder } from "@/lib/supabase";
import type { Order } from "@/types";
import type { MenuItem } from "@/types";

// ── Helpers ───────────────────────────────────────────────
const fmtElapsed = (s: string, ref?: string | null) => {
  const base = ref ? new Date(ref) : new Date(s);
  const min = Math.floor((Date.now() - base.getTime()) / 60000);
  return `${min} นาทีที่แล้ว`;
};
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (s: string) =>
  new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const orderCode = (id: number) => `#${String(7000 + id).slice(-4)}`;

// ── สี & ฟอนต์ (Paper / Clipboard theme) ────────────────────
const C = {
  bg:     "#F7F2E7",
  paper:  "#FFFFFF",
  paper2: "#FBF7EE",
  line:   "#E1D6BE",
  ink:    "#2B2A26",
  inkSoft:"#807A6B",

  sage:   "#5F7F63",
  sageBg: "#E5EBDF",
  ochre:  "#B5842E",
  ochreBg:"#F4E7CC",
  plum:   "#8C3A4B",
  plumBg: "#F3DEE1",

  photoBg: "#EFE7D4",
};
const FD = "'Taviraj', serif";
const FB = "'Noto Sans Thai', sans-serif";
const FM = "'Courier Prime', monospace";
const DEFAULT_CATS = ["ข้าว", "ก๋วยเตี๋ยว", "เครื่องดื่ม"];

// ── Icons (เล็ก ๆ ใช้ซ้ำ) ───────────────────────────────────
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 12, height: 12 }}><path d="M4 12l5 5L20 6" /></svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 12, height: 12 }}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const IconPhoto = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 26, height: 26 }}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-4 4-2-2-6 6" /></svg>
);
const IconLock = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ width: 16, height: 16 }}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);

// ── "ตั๋ว" การ์ดออเดอร์ — เทป+ขอบฉีก ─────────────────────────
function TicketShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.paper2, border: `1px solid ${C.line}`, borderRadius: 2, position: "relative", paddingTop: 14, marginBottom: 8 }}>
      <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", width: 46, height: 16, background: "#B7BDBE", borderRadius: 3, boxShadow: "0 2px 3px rgba(0,0,0,0.2)" }} />
      {children}
      <div style={{ position: "absolute", bottom: -6, left: 0, right: 0, height: 12, backgroundImage: `linear-gradient(135deg, transparent 50%, ${C.bg} 50%)`, backgroundSize: "10px 12px", backgroundRepeat: "repeat-x" }} />
    </div>
  );
}

const stateTagStyle = (kind: "pending" | "cooking" | "attn") => ({
  fontSize: 11, fontWeight: 700, padding: "3px 11px", borderRadius: 3, fontFamily: FD,
  background: kind === "pending" ? C.ochreBg : kind === "attn" ? C.plumBg : C.sageBg,
  color:      kind === "pending" ? C.ochre   : kind === "attn" ? C.plum   : C.sage,
});

// ─────────────────────────────────────────────────────────
export default function KitchenPage() {
  // ── Auth ──────────────────────────────────────────────
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [unlocked,   setUnlocked]   = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [loggingIn,  setLoggingIn]  = useState(false);

  // ── Clock ─────────────────────────────────────────────
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);

  // ── Tab ───────────────────────────────────────────────
  const [tab, setTab] = useState<"order" | "menu" | "history">("order");

  // ── Orders state ──────────────────────────────────────
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [hdays,   setHdays]   = useState(1);
  const [toast,   setToast]   = useState(false);
  const [clearedIds, setClearedIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("kitchen_cleared_ids");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  // สถานะติ๊กถูก/กากบาทรายชิ้น — เก็บชั่วคราวในหน่วยความจำ (รีเฟรชแล้วรีเซ็ต)
  const [itemMarks, setItemMarks] = useState<Record<string, "ok" | "no">>({});
  const audioRef = useRef<AudioContext | null>(null);

  // ── Custom Orders state ──────────────────────────────
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);

  // ── ประกาศถึงลูกค้า ───────────────────────────────────
  const [announceText, setAnnounceText] = useState("เมนูวันนี้อัปเดตแล้ว — กะเพราหมูกรอบพร้อมเสิร์ฟ");
  const [announceEditing, setAnnounceEditing] = useState(false);
  const [announceDraft, setAnnounceDraft] = useState(announceText);
  const [annSending, setAnnSending] = useState(false);

  // ── Menu state ────────────────────────────────────────
  const [items,      setItems]      = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuCat,    setMenuCat]    = useState("ทั้งหมด");
  const [editing,    setEditing]    = useState<number | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editPrice,  setEditPrice]  = useState("");
  const [editIng,    setEditIng]    = useState("");
  const [editDailyLimit, setEditDailyLimit] = useState("");
  const [editImageFile,    setEditImageFile]    = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [saving,     setSaving]     = useState<number | null>(null);
  const [menuToast,  setMenuToast]  = useState("");
  const [showAdd,    setShowAdd]    = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newPrice,   setNewPrice]   = useState("");
  const [newCat,     setNewCat]     = useState("ข้าว");
  const [newCatCustom, setNewCatCustom] = useState(false);
  const [newCatText,   setNewCatText]   = useState("");
  const [newEmoji,   setNewEmoji]   = useState("🍽️");
  const [newIng,     setNewIng]     = useState("");
  const [newDailyLimit, setNewDailyLimit] = useState("");
  const [newImageFile,    setNewImageFile]    = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [adding,     setAdding]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // ── Login handler (Supabase Auth) ──────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoggingIn(true);
    setLoginError(false);
    try {
      await signInStaff(email.trim(), password);
      setUnlocked(true);
    } catch {
      setLoginError(true);
    } finally {
      setLoggingIn(false);
    }
  };
  const handleLock = async () => {
    if (!window.confirm("ออกจากระบบและกลับไปหน้า login?")) return;
    await signOutStaff();
    setUnlocked(false);
    setEmail(""); setPassword("");
  };

  // ── Flag ชื่อที่หลุดผ่าน blacklist มาได้ — เข้าคิว /admin ตรวจสอบ ──
  const handleFlag = async (orderId: number, name: string) => {
    if (!window.confirm(`รายงานชื่อ "${name}" ว่าไม่เหมาะสม?`)) return;
    try {
      await flagOrderName(orderId, name);
      showMenuToast("รายงานแล้ว — แอดมินจะตรวจสอบทีหลัง");
    } catch (e: any) {
      alert("รายงานไม่สำเร็จ: " + (e?.message ?? ""));
    }
  };

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
    });
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
        supabase.from("orders_with_items").select("*").eq("id", payload.new.id).single()
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

  // ── Order handlers (ปกติ) ─────────────────────────────
  const acceptOrder = async (id: number) => {
    try {
      await updateOrderStatus(id, "cooking");
      setOrders(p => p.map(o => o.id === id ? { ...o, status: "cooking", started_at: new Date().toISOString() } : o));
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const rejectOrder = async (id: number) => {
    if (!window.confirm("ยืนยันปฏิเสธออเดอร์นี้?\nออเดอร์จะถูกยกเลิกและแจ้งผู้สั่งทันที")) return;
    try {
      const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      setOrders(p => p.map(o => o.id === id ? { ...o, status: "cancelled" as any } : o));
      playAlert();
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const completeOrder = async (id: number) => {
    try {
      await updateOrderStatus(id, "done");
      setClearedIds(prev => {
        const next = new Set(prev); next.add(id);
        localStorage.setItem("kitchen_cleared_ids", JSON.stringify([...next]));
        return next;
      });
      setOrders(p => p.filter(o => o.id !== id));
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const setItemMark = (orderId: number, idx: number, mark: "ok" | "no") => {
    const key = `${orderId}_${idx}`;
    setItemMarks(prev => {
      const next = { ...prev };
      if (next[key] === mark) delete next[key]; else next[key] = mark;
      return next;
    });
  };

  // ── Custom Order handlers ────────────────────────────
  const acceptCustom = async (id: number) => {
    try {
      await updateCustomOrderStatus(id, "cooking");
      setCustomOrders(p => p.map(o => o.id === id ? { ...o, status: "cooking", started_at: new Date().toISOString() } : o));
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const rejectCustom = async (id: number) => {
    if (!window.confirm("ยืนยันปฏิเสธรายการตามสั่งนี้?")) return;
    try {
      await cancelCustomOrder(id);
      setCustomOrders(p => p.filter(o => o.id !== id));
      playAlert();
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const completeCustom = async (id: number) => {
    try {
      await updateCustomOrderStatus(id, "done");
      setClearedIds(prev => {
        const next = new Set(prev); next.add(-id);
        localStorage.setItem("kitchen_cleared_ids", JSON.stringify([...next]));
        return next;
      });
      setCustomOrders(p => p.filter(o => o.id !== id));
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
    setEditing(editing === item.id ? null : item.id);
    setEditName(item.name);
    setEditPrice(String(item.price)); setEditIng((item as any).ingredients ?? "");
    setEditDailyLimit(item.daily_limit != null ? String(item.daily_limit) : "");
    setEditImageFile(null); setEditImagePreview((item as any).image_url ?? null);
  };

  const handleSave = async (item: MenuItem) => {
    const p = parseInt(editPrice);
    if (!editName.trim()) { alert("กรุณากรอกชื่อเมนู"); return; }
    if (!p || p <= 0) { alert("ราคาไม่ถูกต้อง"); return; }
    const dailyLimit = editDailyLimit.trim() === "" ? null : parseInt(editDailyLimit);
    if (dailyLimit !== null && (!Number.isFinite(dailyLimit) || dailyLimit <= 0)) {
      alert("จำนวนจำกัด/วัน ต้องเป็นตัวเลขมากกว่า 0 (เว้นว่างถ้าไม่จำกัด)"); return;
    }
    setSaving(item.id);
    try {
      let image_url = (item as any).image_url ?? null;
      if (editImageFile) {
        setImgUploading(true);
        const uploaded = await uploadMenuImage(editImageFile, item.id);
        if (image_url) deleteMenuImage(image_url);
        image_url = uploaded;
        setImgUploading(false);
      }
      await updateMenuItem(item.id, { name: editName.trim(), price: p, ingredients: editIng.trim(), image_url, daily_limit: dailyLimit });
      setItems(prev => prev.map(m => m.id === item.id ? { ...m, name: editName.trim(), price: p, ingredients: editIng.trim(), image_url, daily_limit: dailyLimit } as any : m));
      setEditing(null); setEditImageFile(null); setEditImagePreview(null);
      showMenuToast(`อัปเดต "${editName.trim()}" แล้ว`);
    } catch (e: any) { alert("บันทึกไม่สำเร็จ: " + (e?.message ?? "")); setImgUploading(false); }
    finally { setSaving(null); }
  };

  const handleAddMenu = async () => {
    if (!newName.trim()) { alert("กรุณากรอกชื่อเมนู"); return; }
    const p = parseInt(newPrice);
    if (!p || p <= 0) { alert("ราคาไม่ถูกต้อง"); return; }
    const finalCat = newCatCustom ? newCatText.trim() : newCat;
    if (!finalCat) { alert("กรุณาเลือกหรือพิมพ์หมวดหมู่"); return; }
    const dailyLimit = newDailyLimit.trim() === "" ? null : parseInt(newDailyLimit);
    if (dailyLimit !== null && (!Number.isFinite(dailyLimit) || dailyLimit <= 0)) {
      alert("จำนวนจำกัด/วัน ต้องเป็นตัวเลขมากกว่า 0 (เว้นว่างถ้าไม่จำกัด)"); return;
    }
    setAdding(true);
    try {
      let image_url: string | null = null;
      if (newImageFile) {
        setImgUploading(true);
        image_url = await uploadMenuImage(newImageFile);
        setImgUploading(false);
      }
      const created = await createMenuItem({ name: newName.trim(), price: p, category: finalCat, emoji: newEmoji, ingredients: newIng.trim(), image_url, daily_limit: dailyLimit });
      setItems(prev => [...prev, created as MenuItem]);
      setShowAdd(false);
      setNewName(""); setNewPrice(""); setNewIng(""); setNewEmoji("🍽️"); setNewDailyLimit("");
      setNewCatCustom(false); setNewCatText(""); setNewCat("ข้าว");
      setNewImageFile(null); setNewImagePreview(null);
      showMenuToast(`เพิ่มเมนู "${created.name}" แล้ว`);
    } catch (e: any) { alert("เพิ่มเมนูไม่สำเร็จ: " + (e?.message ?? "")); setImgUploading(false); }
    finally { setAdding(false); }
  };

  const handleDeleteMenu = async (item: MenuItem) => {
    try {
      await deleteMenuItem(item.id);
      if ((item as any).image_url) deleteMenuImage((item as any).image_url);
      setItems(prev => prev.filter(m => m.id !== item.id));
      setDeleteConfirm(null); setEditing(null); showMenuToast(`ลบ "${item.name}" แล้ว`);
    } catch (e: any) { alert("ลบไม่สำเร็จ: " + (e?.message ?? "")); }
  };

  const handleSaveAnnounce = async () => {
    if (!announceDraft.trim()) return;
    setAnnSending(true);
    try {
      await createAnnouncement(announceDraft.trim());
      setAnnounceText(announceDraft.trim());
      setAnnounceEditing(false);
      showMenuToast("ส่งประกาศแล้ว");
    } catch { alert("เกิดข้อผิดพลาด"); }
    finally { setAnnSending(false); }
  };

  const allCats = Array.from(new Set([...DEFAULT_CATS, ...items.map(m => m.category)])).sort();
  const CATS = ["ทั้งหมด", ...allCats];
  const filtered = menuCat === "ทั้งหมด" ? items : items.filter(m => m.category === menuCat);

  // ── รวมตั๋วออเดอร์ (ปกติ + ตามสั่ง) เรียงใหม่สุดก่อน ────────
  type Ticket =
    | { kind: "reg"; sortTime: number; o: Order }
    | { kind: "custom"; sortTime: number; o: CustomOrder };
  const tickets: Ticket[] = [
    ...orders.filter(o => o.status === "new" || o.status === "cooking")
      .map(o => ({ kind: "reg" as const, sortTime: new Date(o.created_at).getTime(), o })),
    ...customOrders.filter(o => o.status === "new" || o.status === "cooking")
      .map(o => ({ kind: "custom" as const, sortTime: new Date(o.created_at).getTime(), o })),
  ].sort((a, b) => b.sortTime - a.sortTime);
  const pendingCount = orders.filter(o => o.status === "new").length + customOrders.filter(o => o.status === "new").length;

  const dateLabel = `${now.toLocaleDateString("th-TH", { weekday: "long" })}ที่ ${now.getDate()} ${now.toLocaleDateString("th-TH", { month: "short" })}`;
  const clockLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // ── LOGIN SCREEN ──────────────────────────────────────
  if (!unlocked) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Taviraj:wght@500;600;700&family=Noto+Sans+Thai:wght@400;500;600&family=Courier+Prime:wght@400;700&display=swap');`}</style>
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: FB, padding: 24 }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", border: `2px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, fontFamily: FD, marginBottom: 20, background: C.paper }}>PP</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginBottom: 6, fontFamily: FD }}>ครัว PETPAL</div>
        <div style={{ fontSize: 14, color: C.inkSoft, marginBottom: 28, fontFamily: FM }}>เข้าสู่ระบบเพื่อใช้งาน</div>
        <form
          onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
          style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 300, width: "100%" }}
        >
          <input
            type="email" autoComplete="username" placeholder="อีเมล" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "14px 16px", border: `1.5px solid ${C.line}`, borderRadius: 8, fontSize: 16, fontFamily: FM, background: C.paper, color: C.ink }}
          />
          <input
            type="password" autoComplete="current-password" placeholder="รหัสผ่าน" value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "14px 16px", border: `1.5px solid ${C.line}`, borderRadius: 8, fontSize: 16, fontFamily: FM, background: C.paper, color: C.ink }}
          />
          <button
            type="submit" disabled={loggingIn || !email.trim() || !password}
            style={{ padding: "14px 0", border: "none", borderRadius: 8, background: C.ink, color: C.paper, fontSize: 16, fontWeight: 600, fontFamily: FD, cursor: loggingIn ? "default" : "pointer", opacity: loggingIn ? 0.6 : 1 }}
          >
            {loggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        {loginError && <div style={{ color: C.plum, fontSize: 14, marginTop: 18, fontWeight: 700, fontFamily: FD }}>อีเมลหรือรหัสผ่านไม่ถูกต้อง</div>}
      </div>
    </>
  );

  // ── MAIN ──────────────────────────────────────────────
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Taviraj:wght@500;600;700&family=Noto+Sans+Thai:wght@400;500;600&family=Courier+Prime:wght@400;700&display=swap');`}</style>
      <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FB, paddingBottom: 60 }}>

        {/* Toast ออเดอร์ใหม่ */}
        {toast && (
          <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.sage, color: C.paper, padding: "12px 28px", borderRadius: "0 0 10px 10px", fontSize: 14, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap", fontFamily: FD }}>
            📌 มีออเดอร์ใหม่!
          </div>
        )}
        {menuToast && (
          <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.ochre, color: C.paper, padding: "12px 28px", borderRadius: "0 0 10px 10px", fontSize: 14, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap", fontFamily: FD }}>
            ✓ {menuToast}
          </div>
        )}

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 26px 14px", borderBottom: `2px solid ${C.ink}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: `2px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontWeight: 700, fontSize: 16 }}>PP</div>
            <div>
              <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 23, color: C.ink }}>ครัว PETPAL</div>
              <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: FM, marginTop: 2 }}>รายการเตรียมอาหาร · {dateLabel}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: FM, fontSize: 13, color: C.inkSoft, textAlign: "right" }}>
              <b style={{ color: C.ink, display: "block", fontSize: 15 }}>{clockLabel}</b>
              เวลาปัจจุบัน
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.sage, fontSize: 13, fontWeight: 600, fontFamily: FD }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.sage }} />เปิดรับออเดอร์
            </div>
            <button onClick={handleLock} style={{ width: 38, height: 38, borderRadius: "50%", border: `1.5px solid ${C.ink}`, background: "transparent", color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><IconLock /></button>
          </div>
        </header>

        {/* ประกาศถึงลูกค้า */}
        <div style={{ padding: "18px 26px 0" }}>
          {!announceEditing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.sageBg, borderRadius: 4, padding: "12px 18px" }}>
              <span style={{ fontSize: 14 }}>📌</span>
              <span style={{ fontSize: 14, fontWeight: 500, flex: 1, fontStyle: "italic", color: C.ink }}>{announceText}</span>
              <button onClick={() => { setAnnounceDraft(announceText); setAnnounceEditing(true); }} style={{ background: "none", border: "none", color: C.sage, fontSize: 12, cursor: "pointer", textDecoration: "underline", fontWeight: 600, fontFamily: FB }}>เขียนประกาศเอง</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <textarea value={announceDraft} onChange={e => setAnnounceDraft(e.target.value)}
                style={{ flex: 1, border: `1.5px solid ${C.line}`, borderRadius: 4, padding: "10px 14px", fontFamily: FB, fontSize: 14, resize: "vertical", minHeight: 44, background: C.paper, color: C.ink }} />
              <button onClick={handleSaveAnnounce} disabled={annSending} style={{ background: C.ink, color: C.paper, border: "none", borderRadius: 4, padding: "0 18px", fontWeight: 700, cursor: "pointer", fontFamily: FD }}>{annSending ? "..." : "บันทึก"}</button>
            </div>
          )}
        </div>

        {/* Folder tabs */}
        <nav style={{ display: "flex", gap: 4, padding: "24px 26px 0" }}>
          {[
            ["order",   "ออเดอร์", pendingCount],
            ["menu",    "เมนู",   0],
            ["history", "ประวัติ", 0],
          ].map(([t, label, count]) => (
            <button key={t as string} onClick={() => setTab(t as any)}
              style={{
                background: tab === t ? C.paper : C.paper2, border: `2px solid ${C.ink}`, borderBottom: tab === t ? `2px solid ${C.paper}` : `2px solid ${C.ink}`,
                padding: tab === t ? "10px 24px 14px" : "10px 24px 12px", borderRadius: "8px 8px 0 0", cursor: "pointer",
                fontFamily: FD, fontWeight: 600, fontSize: 15, color: tab === t ? C.ink : C.inkSoft,
                position: "relative", top: tab === t ? 0 : 2, marginBottom: -2,
              }}>
              {label as string}
              {(count as number) > 0 && <span style={{ background: C.plum, color: C.paper, fontFamily: FM, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, marginLeft: 6 }}>{count as number}</span>}
            </button>
          ))}
        </nav>

        {/* Panel */}
        <section style={{ background: C.paper, border: `2px solid ${C.ink}`, borderRadius: "0 8px 8px 8px", margin: "0 26px", padding: 24, minHeight: 200 }}>

          {/* ══════ ออเดอร์ ══════ */}
          {tab === "order" && (
            tickets.length === 0 ? (
              <div style={{ color: C.inkSoft, padding: 14, fontStyle: "italic" }}>ยังไม่มีออเดอร์เข้ามาตอนนี้</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 22 }}>
                {tickets.map(t => {
                  if (t.kind === "custom") {
                    const o = t.o;
                    return (
                      <TicketShell key={`c${o.id}`}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 10px", borderBottom: `1px dashed ${C.line}` }}>
                          <div>
                            <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: C.ink }}>{orderCode(o.id)} <span style={{ fontSize: 10, color: C.ochre, fontFamily: FD }}>✏️ ตามสั่ง</span></div>
                            <div style={{ fontFamily: FM, fontSize: 11, color: C.inkSoft }}>{fmtTime(o.created_at)} · {fmtElapsed(o.created_at, o.started_at)}</div>
                          </div>
                          <span style={stateTagStyle(o.status === "new" ? "pending" : "cooking")}>{o.status === "new" ? "รอตอบรับ" : "กำลังเตรียม"}</span>
                        </div>
                        <div style={{ padding: "10px 18px 4px" }}>
                          <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                            👤 {o.customer_name}
                            <button onClick={() => handleFlag(o.id, o.customer_name)} title="รายงานชื่อไม่เหมาะสม" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: C.inkSoft, opacity: 0.6 }}>🚩</button>
                          </div>
                          <div style={{ fontSize: 14, color: C.ink, padding: "6px 0", whiteSpace: "pre-wrap" }}>{o.items}</div>
                          {o.note && <div style={{ fontSize: 12.5, color: C.ochre, fontStyle: "italic", marginBottom: 6 }}>📝 {o.note}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 8, padding: "14px 18px 18px" }}>
                          {o.status === "new" ? (
                            <>
                              <button onClick={() => acceptCustom(o.id)} style={{ flex: 1, border: `1.5px solid ${C.sage}`, borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: C.sage, color: C.paper }}>รับออเดอร์</button>
                              <button onClick={() => rejectCustom(o.id)} style={{ flex: 1, border: `1.5px solid ${C.plum}`, borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: "transparent", color: C.plum }}>ปฏิเสธ</button>
                            </>
                          ) : (
                            <button onClick={() => completeCustom(o.id)} style={{ flex: 1, border: "none", borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: C.ink, color: C.paper }}>ส่งอาหารแล้ว</button>
                          )}
                        </div>
                      </TicketShell>
                    );
                  }
                  const o = t.o;
                  const hasAttn = o.status === "cooking" && o.items.some((_, i) => itemMarks[`${o.id}_${i}`] === "no");
                  const tagKind = o.status === "new" ? "pending" : hasAttn ? "attn" : "cooking";
                  const tagLabel = o.status === "new" ? "รอตอบรับ" : hasAttn ? "แจ้งลูกค้า" : "กำลังเตรียม";
                  return (
                    <TicketShell key={`o${o.id}`}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 10px", borderBottom: `1px dashed ${C.line}` }}>
                        <div>
                          <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: C.ink }}>{orderCode(o.id)}</div>
                          <div style={{ fontFamily: FM, fontSize: 11, color: C.inkSoft }}>{fmtTime(o.created_at)} · {fmtElapsed(o.created_at, o.started_at)}</div>
                        </div>
                        <span style={stateTagStyle(tagKind)}>{tagLabel}</span>
                      </div>
                      <div style={{ padding: "10px 18px 4px" }}>
                        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          👤 {o.customer_name}
                          <button onClick={() => handleFlag(o.id, o.customer_name)} title="รายงานชื่อไม่เหมาะสม" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: C.inkSoft, opacity: 0.6 }}>🚩</button>
                        </div>
                        {o.items.map((it, i) => {
                          const key = `${o.id}_${i}`;
                          const mark = itemMarks[key];
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 14.5, borderBottom: i < o.items.length - 1 ? `1px dotted ${C.line}` : "none", color: C.ink }}>
                              <span style={{ fontFamily: FM, color: C.inkSoft, fontSize: 12, minWidth: 20 }}>x{it.qty}</span>
                              <span style={{ flex: 1 }}>{it.name}</span>
                              {o.status === "cooking" && (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => setItemMark(o.id, i, "ok")} style={{ width: 25, height: 25, border: `1.5px solid ${mark === "ok" ? C.sage : C.ink}`, background: mark === "ok" ? C.sage : C.paper, color: mark === "ok" ? C.paper : C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3 }}><IconCheck /></button>
                                  <button onClick={() => setItemMark(o.id, i, "no")} style={{ width: 25, height: 25, border: `1.5px solid ${mark === "no" ? C.plum : C.ink}`, background: mark === "no" ? C.plum : C.paper, color: mark === "no" ? C.paper : C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3 }}><IconX /></button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {o.note && <div style={{ fontSize: 12.5, color: C.ochre, fontStyle: "italic", margin: "6px 0" }}>📝 {o.note}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, padding: "14px 18px 18px" }}>
                        {o.status === "new" ? (
                          <>
                            <button onClick={() => acceptOrder(o.id)} style={{ flex: 1, border: `1.5px solid ${C.sage}`, borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: C.sage, color: C.paper }}>รับออเดอร์</button>
                            <button onClick={() => rejectOrder(o.id)} style={{ flex: 1, border: `1.5px solid ${C.plum}`, borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: "transparent", color: C.plum }}>ปฏิเสธ</button>
                          </>
                        ) : (
                          <button onClick={() => completeOrder(o.id)} style={{ flex: 1, border: "none", borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: C.ink, color: C.paper }}>ส่งอาหารแล้ว</button>
                        )}
                      </div>
                    </TicketShell>
                  );
                })}
              </div>
            )
          )}

          {/* ══════ เมนู ══════ */}
          {tab === "menu" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {CATS.map(c => (
                    <button key={c} onClick={() => setMenuCat(c)}
                      style={{ padding: "6px 15px", borderRadius: 3, border: `1.5px solid ${C.ink}`, background: menuCat === c ? C.ink : "transparent", fontSize: 13, color: menuCat === c ? C.paper : C.ink, cursor: "pointer", fontWeight: 500, fontFamily: FD }}>
                      {c}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAdd(v => !v)} style={{ background: C.ink, color: C.paper, border: "none", borderRadius: 3, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD }}>+ เพิ่มเมนู</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 16 }}>
                <div onClick={() => setShowAdd(v => !v)} style={{ border: `1.5px dashed ${C.inkSoft}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 175, cursor: "pointer", color: C.inkSoft, flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 13, fontFamily: FD }}>
                  <span style={{ fontSize: 22 }}>+</span><div>เพิ่มเมนูใหม่</div>
                </div>

                {showAdd && (
                  <div style={{ gridColumn: "1 / -1", background: C.paper2, border: `1.5px solid ${C.ink}`, borderRadius: 4, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <label style={{ width: 60, height: 60, borderRadius: 4, background: C.photoBg, border: `1px dashed ${C.inkSoft}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0, color: C.inkSoft }}>
                        {newImagePreview ? <img src={newImagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconPhoto />}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setNewImageFile(f); setNewImagePreview(URL.createObjectURL(f)); }} />
                      </label>
                      <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🍽️" style={{ width: 50, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 6px", textAlign: "center", fontSize: 16, fontFamily: FB, color: C.ink }} />
                      <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อเมนู" style={{ flex: 1, minWidth: 140, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                      <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="ราคา" style={{ width: 100, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                      {!newCatCustom ? (
                        <select value={newCat} onChange={e => { if (e.target.value === "__custom__") { setNewCatCustom(true); setNewCatText(""); } else setNewCat(e.target.value); }}
                          style={{ minWidth: 140, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }}>
                          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__custom__">+ หมวดใหม่...</option>
                        </select>
                      ) : (
                        <div style={{ display: "flex", gap: 6, minWidth: 140 }}>
                          <input value={newCatText} onChange={e => setNewCatText(e.target.value)} placeholder="หมวดใหม่" autoFocus style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.ochre}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                          <button onClick={() => { setNewCatCustom(false); setNewCatText(""); }} style={{ padding: "0 10px", background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, color: C.inkSoft, cursor: "pointer" }}>✕</button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input value={newIng} onChange={e => setNewIng(e.target.value)} placeholder="วัตถุดิบ (ถ้ามี)" style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                      <input type="number" min={1} value={newDailyLimit} onChange={e => setNewDailyLimit(e.target.value)} placeholder="จำกัด/วัน (ว่าง=ไม่จำกัด)" style={{ width: 170, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => setShowAdd(false)} style={{ background: "transparent", border: `1.5px solid ${C.inkSoft}`, color: C.inkSoft, borderRadius: 3, padding: "9px 18px", cursor: "pointer", fontFamily: FD }}>ยกเลิก</button>
                      <button onClick={handleAddMenu} disabled={adding} style={{ background: C.sage, color: C.paper, border: "none", borderRadius: 3, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontFamily: FD }}>{adding ? (imgUploading ? "กำลังอัปโหลดรูป..." : "กำลังเพิ่ม...") : "บันทึก"}</button>
                    </div>
                  </div>
                )}

                {loadingMenu ? (
                  <div style={{ color: C.inkSoft, padding: 20 }}>กำลังโหลด...</div>
                ) : filtered.map(item => (
                  <div key={item.id} style={{ gridColumn: editing === item.id ? "1 / -1" : undefined }}>
                    <div style={{ background: C.paper2, border: `1px solid ${C.line}`, borderRadius: 3, overflow: "hidden", display: "flex", flexDirection: "column", opacity: item.available ? 1 : 0.45 }}>
                      <div style={{ height: 115, background: C.photoBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, overflow: "hidden" }}>
                        {(item as any).image_url ? <img src={(item as any).image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconPhoto />}
                      </div>
                      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, fontFamily: FD, color: C.ink }}>{item.name}</div>
                          <div style={{ fontFamily: FM, fontWeight: 700, color: C.ochre, fontSize: 14 }}>{item.price}฿</div>
                        </div>
                        <div style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>{(item as any).ingredients || "—"}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderTop: `1px dashed ${C.line}` }}>
                        <label style={{ position: "relative", width: 36, height: 19, cursor: saving === item.id ? "not-allowed" : "pointer" }}>
                          <input type="checkbox" checked={item.available} disabled={saving === item.id} onChange={() => handleToggle(item)} style={{ display: "none" }} />
                          <div style={{ position: "absolute", inset: 0, background: item.available ? C.sageBg : C.line, border: `1px solid ${item.available ? C.sage : C.inkSoft}`, borderRadius: 999 }} />
                          <div style={{ position: "absolute", top: 2, left: item.available ? 19 : 2, width: 15, height: 15, borderRadius: "50%", background: item.available ? C.sage : "#fff", border: `1px solid ${item.available ? C.sage : C.inkSoft}`, transition: "left .15s" }} />
                        </label>
                        <button onClick={() => openEdit(item)} style={{ width: 25, height: 25, border: `1.5px solid ${C.ink}`, background: C.paper, color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, fontSize: 12 }}>✎</button>
                      </div>
                    </div>

                    {editing === item.id && (
                      <div style={{ background: C.paper2, border: `1.5px solid ${C.ink}`, borderRadius: 4, padding: 16, marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <label style={{ width: 60, height: 60, borderRadius: 4, background: C.photoBg, border: `1px dashed ${C.inkSoft}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0, color: C.inkSoft }}>
                            {editImagePreview ? <img src={editImagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconPhoto />}
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setEditImageFile(f); setEditImagePreview(URL.createObjectURL(f)); }} />
                          </label>
                          <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="ชื่อเมนู" style={{ flex: 1, minWidth: 140, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                          <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="ราคา" style={{ width: 100, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <input value={editIng} onChange={e => setEditIng(e.target.value)} placeholder="วัตถุดิบ" style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                          <input type="number" min={1} value={editDailyLimit} onChange={e => setEditDailyLimit(e.target.value)} placeholder="จำกัด/วัน (ว่าง=ไม่จำกัด)" style={{ width: 170, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
                        </div>
                        {item.remaining_today !== null && item.remaining_today !== undefined && (
                          <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: FB }}>
                            วันนี้เหลือ {item.remaining_today} / {item.daily_limit} ที่
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => setDeleteConfirm(item.id)} style={{ background: "transparent", border: `1.5px solid ${C.plum}`, color: C.plum, borderRadius: 3, padding: "9px 14px", cursor: "pointer", fontFamily: FD }}>ลบ</button>
                          <button onClick={() => setEditing(null)} style={{ background: "transparent", border: `1.5px solid ${C.inkSoft}`, color: C.inkSoft, borderRadius: 3, padding: "9px 18px", cursor: "pointer", fontFamily: FD }}>ยกเลิก</button>
                          <button onClick={() => handleSave(item)} disabled={saving === item.id} style={{ background: C.sage, color: C.paper, border: "none", borderRadius: 3, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontFamily: FD }}>{saving === item.id ? (imgUploading ? "กำลังอัปโหลดรูป..." : "กำลังบันทึก...") : "บันทึก"}</button>
                        </div>
                        {deleteConfirm === item.id && (
                          <div style={{ padding: 12, background: C.plumBg, borderRadius: 4 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.plum, marginBottom: 8, fontFamily: FB }}>⚠️ ลบ &quot;{item.name}&quot; ถาวร?</div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => handleDeleteMenu(item)} style={{ flex: 1, padding: 8, background: C.plum, color: C.paper, border: "none", borderRadius: 3, fontWeight: 700, cursor: "pointer", fontFamily: FD }}>ยืนยันลบ</button>
                              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: 8, background: C.paper, color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 3, cursor: "pointer", fontFamily: FD }}>ไม่ลบ</button>
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

          {/* ══════ ประวัติ ══════ */}
          {tab === "history" && (() => {
            const isDoneOf = (o: Order) => o.status === "done";
            const isCancelOf = (o: Order) => o.status === ("cancelled" as any);
            return (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[1,7,30].map(d => (
                    <button key={d} onClick={() => setHdays(d)}
                      style={{ padding: "6px 15px", borderRadius: 3, border: `1.5px solid ${C.ink}`, background: hdays === d ? C.ink : "transparent", color: hdays === d ? C.paper : C.ink, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FD }}>
                      {d === 1 ? "วันนี้" : `${d} วัน`}
                    </button>
                  ))}
                </div>
                {history.length === 0 ? (
                  <div style={{ color: C.inkSoft, padding: 10 }}>ยังไม่มีประวัติ</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {history.map(o => (
                      <div key={o.id} style={{ display: "grid", gridTemplateColumns: "90px 90px 1fr 100px", gap: 14, alignItems: "center", padding: "12px 6px", borderBottom: `1px dashed ${C.line}`, fontSize: 13.5 }}>
                        <span style={{ fontFamily: FM, color: C.inkSoft }}>{fmtDate(o.created_at)}</span>
                        <span style={{ fontFamily: FM, fontWeight: 600, color: C.ink }}>{orderCode(o.id)}</span>
                        <span style={{ color: C.inkSoft, fontSize: 12.5, fontStyle: "italic", textDecoration: isCancelOf(o) ? "line-through" : "none" }}>{o.items.map(it => `${it.name} x${it.qty}`).join(", ")}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 3, textAlign: "center", fontFamily: FD, background: isDoneOf(o) ? C.sageBg : C.plumBg, color: isDoneOf(o) ? C.sage : C.plum }}>
                          {isDoneOf(o) ? "เสร็จสิ้น" : "ยกเลิก"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      </div>
    </>
  );
}
