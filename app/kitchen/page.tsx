"use client";
// ─── app/kitchen/page.tsx ─────────────────────────────────
// รวม: ออเดอร์ (Clipboard tickets) + จัดการเมนู + ประวัติ — login ด้วย Supabase Auth
// Redesign: "prep clipboard" paper theme — เอกสารกระดาษ/ใบสั่งครัว
//
// หน้านี้เป็น container: ถือ state/effects/handlers ทั้งหมด แล้วส่งลงไปให้
// component ย่อยใน app/kitchen/components/ วาด UI — ไม่มีการเปลี่ยนพฤติกรรม
// จากเดิม แค่แยกไฟล์ให้อ่าน/ดูแลง่ายขึ้น

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
import { C, FB, DEFAULT_CATS } from "./shared";
import { LoginScreen } from "./components/LoginScreen";
import { KitchenHeader } from "./components/KitchenHeader";
import { AnnouncementBar } from "./components/AnnouncementBar";
import { KitchenTabs, type KitchenTab } from "./components/KitchenTabs";
import { OrdersPanel, type Ticket } from "./components/OrdersPanel";
import { MenuPanel } from "./components/MenuPanel";
import { HistoryPanel } from "./components/HistoryPanel";

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
  const [tab, setTab] = useState<KitchenTab>("order");

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
    <LoginScreen
      email={email} setEmail={setEmail}
      password={password} setPassword={setPassword}
      loginError={loginError} loggingIn={loggingIn}
      onSubmit={handleLogin}
    />
  );

  // ── MAIN ──────────────────────────────────────────────
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Taviraj:wght@500;600;700&family=Noto+Sans+Thai:wght@400;500;600&family=Courier+Prime:wght@400;700&display=swap');`}</style>
      <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FB, paddingBottom: 60 }}>

        {/* Toast ออเดอร์ใหม่ */}
        {toast && (
          <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.sage, color: C.paper, padding: "12px 28px", borderRadius: "0 0 10px 10px", fontSize: 14, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap", fontFamily: "'Taviraj', serif" }}>
            📌 มีออเดอร์ใหม่!
          </div>
        )}
        {menuToast && (
          <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.ochre, color: C.paper, padding: "12px 28px", borderRadius: "0 0 10px 10px", fontSize: 14, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap", fontFamily: "'Taviraj', serif" }}>
            ✓ {menuToast}
          </div>
        )}

        <KitchenHeader dateLabel={dateLabel} clockLabel={clockLabel} onLock={handleLock} />

        <AnnouncementBar
          announceText={announceText}
          announceEditing={announceEditing}
          announceDraft={announceDraft}
          setAnnounceDraft={setAnnounceDraft}
          annSending={annSending}
          onStartEdit={() => { setAnnounceDraft(announceText); setAnnounceEditing(true); }}
          onSave={handleSaveAnnounce}
        />

        <KitchenTabs tab={tab} setTab={setTab} pendingCount={pendingCount} />

        {/* Panel */}
        <section style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, margin: "16px 26px 0", padding: 24, minHeight: 200 }}>

          {tab === "order" && (
            <OrdersPanel
              tickets={tickets}
              itemMarks={itemMarks}
              onSetItemMark={setItemMark}
              onAcceptOrder={acceptOrder}
              onRejectOrder={rejectOrder}
              onCompleteOrder={completeOrder}
              onAcceptCustom={acceptCustom}
              onRejectCustom={rejectCustom}
              onCompleteCustom={completeCustom}
              onFlag={handleFlag}
            />
          )}

          {tab === "menu" && (
            <MenuPanel
              CATS={CATS} menuCat={menuCat} setMenuCat={setMenuCat}
              showAdd={showAdd} setShowAdd={setShowAdd}
              allCats={allCats}
              newName={newName} setNewName={setNewName}
              newPrice={newPrice} setNewPrice={setNewPrice}
              newCat={newCat} setNewCat={setNewCat}
              newCatCustom={newCatCustom} setNewCatCustom={setNewCatCustom}
              newCatText={newCatText} setNewCatText={setNewCatText}
              newEmoji={newEmoji} setNewEmoji={setNewEmoji}
              newIng={newIng} setNewIng={setNewIng}
              newDailyLimit={newDailyLimit} setNewDailyLimit={setNewDailyLimit}
              newImagePreview={newImagePreview} setNewImageFile={setNewImageFile} setNewImagePreview={setNewImagePreview}
              adding={adding} imgUploading={imgUploading} onAddMenu={handleAddMenu}
              loadingMenu={loadingMenu} filtered={filtered}
              editing={editing} saving={saving}
              editName={editName} setEditName={setEditName}
              editPrice={editPrice} setEditPrice={setEditPrice}
              editIng={editIng} setEditIng={setEditIng}
              editDailyLimit={editDailyLimit} setEditDailyLimit={setEditDailyLimit}
              editImagePreview={editImagePreview} setEditImageFile={setEditImageFile} setEditImagePreview={setEditImagePreview}
              deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm}
              onToggle={handleToggle}
              onOpenEdit={openEdit}
              onCancelEdit={() => setEditing(null)}
              onSave={handleSave}
              onDeleteMenu={handleDeleteMenu}
            />
          )}

          {tab === "history" && (
            <HistoryPanel history={history} hdays={hdays} setHdays={setHdays} />
          )}
        </section>
      </div>
    </>
  );
}
