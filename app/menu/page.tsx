"use client";
// ─── app/menu/page.tsx ────────────────────────────────────
// หน้าจัดการเมนูสำหรับครัว — แก้ชื่อ/ราคา/วัตถุดิบ + ประกาศแจ้งเตือน

import { useEffect, useState } from "react";
import {
  getMenuItems, toggleMenuItem, updateMenuItem,
  createMenuItem, deleteMenuItem,
  createAnnouncement, subscribeToMenuItems, supabase,
} from "@/lib/supabase";
import type { MenuItem } from "@/types";

const MENU_PIN = process.env.NEXT_PUBLIC_KITCHEN_PIN ?? "1234";

const C = {
  green: "#3B6B0F", greenL: "#EBF3DC", greenB: "#B5D47A",
  red: "#C0392B", redL: "#FDECEA",
  text: "#1C1A17", muted: "#7A7570", border: "#E2DDD6", bg: "#F5F3EE",
  amber: "#C97A14", amberL: "#FEF3DC",
};

// หมวดหมู่เริ่มต้น (ใช้ตอนเพิ่มเมนูใหม่ ถ้ายังไม่มีหมวดหมู่ใดในระบบเลย)
const DEFAULT_CATS = ["ข้าว", "ก๋วยเตี๋ยว", "เครื่องดื่ม"];

export default function MenuPage() {
  const [pin,        setPin]        = useState("");
  const [unlocked,   setUnlocked]   = useState(false);
  const [pinError,   setPinError]   = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [items,      setItems]      = useState<MenuItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [cat,        setCat]        = useState("ทั้งหมด");
  const [editing,    setEditing]    = useState<number | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editPrice,  setEditPrice]  = useState("");
  const [editIng,    setEditIng]    = useState("");
  const [saving,     setSaving]     = useState<number | null>(null);
  const [toast,      setToast]      = useState("");
  const [annText,    setAnnText]    = useState("");
  const [annSending, setAnnSending] = useState(false);
  const [showAnn,    setShowAnn]    = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newPrice,   setNewPrice]   = useState("");
  const [newCat,     setNewCat]     = useState("ข้าว");
  const [newCatCustom, setNewCatCustom] = useState(false);   // true = กำลังพิมพ์หมวดใหม่เอง
  const [newCatText,   setNewCatText]   = useState("");      // ข้อความหมวดที่พิมพ์เอง
  const [newEmoji,   setNewEmoji]   = useState("🍽️");
  const [newIng,     setNewIng]     = useState("");
  const [adding,     setAdding]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const handlePin = (p: string) => {
    setPin(p);
    if (p.length === 4) {
      if (p === MENU_PIN) {
        setUnlocked(true);
        setPinError(false);
        sessionStorage.setItem("kitchen_unlocked", "1");
      }
      else { setPinError(true); setTimeout(() => { setPin(""); setPinError(false); }, 800); }
    }
  };

  // ตรวจ sessionStorage ตอนโหลดหน้า — refresh แล้วไม่ต้องใส่ PIN ซ้ำ
  useEffect(() => {
    if (sessionStorage.getItem("kitchen_unlocked") === "1") setUnlocked(true);
    setCheckingSession(false);
  }, []);

  const handleLock = () => {
    setUnlocked(false);
    sessionStorage.removeItem("kitchen_unlocked");
  };

  useEffect(() => {
    if (!unlocked) return;
    getMenuItems().then(d => setItems(d as MenuItem[])).finally(() => setLoading(false));
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const ch = subscribeToMenuItems((payload) => {
      if (payload.eventType === "UPDATE") {
        setItems(p => p.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [unlocked]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleToggle = async (item: MenuItem) => {
    setSaving(item.id);
    try {
      await toggleMenuItem(item.id, !item.available);
      setItems(p => p.map(m => m.id === item.id ? { ...m, available: !m.available } : m));
      showToast(item.available ? `ปิด "${item.name}" แล้ว` : `เปิด "${item.name}" แล้ว`);
    } catch (e: any) {
      alert("เปิด/ปิดไม่สำเร็จ: " + (e?.message ?? "ตรวจสอบ RLS policy ของตาราง menu_items"));
    }
    finally { setSaving(null); }
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditIng((item as any).ingredients ?? "");
  };

  const handleSave = async (item: MenuItem) => {
    const p = parseInt(editPrice);
    if (!editName.trim()) { alert("กรุณากรอกชื่อเมนู"); return; }
    if (!p || p <= 0) { alert("ราคาไม่ถูกต้อง"); return; }
    setSaving(item.id);
    try {
      await updateMenuItem(item.id, {
        name: editName.trim(),
        price: p,
        ingredients: editIng.trim(),
      });
      setItems(prev => prev.map(m => m.id === item.id
        ? { ...m, name: editName.trim(), price: p, ingredients: editIng.trim() } as any
        : m));
      setEditing(null);
      showToast(`อัปเดต "${editName.trim()}" แล้ว`);
    } catch (e: any) {
      alert("บันทึกไม่สำเร็จ: " + (e?.message ?? "ไม่ทราบสาเหตุ — ตรวจสอบ RLS policy ของตาราง menu_items"));
    }
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
      const created = await createMenuItem({
        name: newName.trim(),
        price: p,
        category: finalCat,
        emoji: newEmoji,
        ingredients: newIng.trim(),
      });
      setItems(prev => [...prev, created as MenuItem]);
      setShowAdd(false);
      setNewName(""); setNewPrice(""); setNewIng(""); setNewEmoji("🍽️");
      setNewCatCustom(false); setNewCatText(""); setNewCat("ข้าว");
      showToast(`เพิ่มเมนู "${created.name}" แล้ว`);
    } catch (e: any) {
      alert("เพิ่มเมนูไม่สำเร็จ: " + (e?.message ?? "ไม่ทราบสาเหตุ — ตรวจสอบ RLS policy"));
    }
    finally { setAdding(false); }
  };

  const handleDelete = async (item: MenuItem) => {
    try {
      await deleteMenuItem(item.id);
      setItems(prev => prev.filter(m => m.id !== item.id));
      setDeleteConfirm(null);
      showToast(`ลบ "${item.name}" แล้ว`);
    } catch (e: any) {
      alert("ลบไม่สำเร็จ: " + (e?.message ?? "ไม่ทราบสาเหตุ — มีออร์เดอร์ที่อ้างอิงเมนูนี้อยู่หรือไม่"));
    }
  };

  const handleAnnounce = async () => {
    if (!annText.trim()) return;
    setAnnSending(true);
    try {
      await createAnnouncement(annText.trim());
      showToast("ส่งประกาศแล้ว ลูกค้าจะเห็นทันที");
      setAnnText("");
      setShowAnn(false);
    } catch { alert("เกิดข้อผิดพลาด"); }
    finally { setAnnSending(false); }
  };

  const quickAnnounce = async () => {
    setAnnSending(true);
    try {
      await createAnnouncement("เมนูวันนี้อัปเดตแล้ว 🍽️");
      showToast("ส่งประกาศแล้ว");
    } catch { alert("เกิดข้อผิดพลาด"); }
    finally { setAnnSending(false); }
  };

  // หมวดหมู่ทั้งหมด = หมวดเริ่มต้น + หมวดที่มีอยู่จริงในเมนู (ไม่ซ้ำ) เรียงตามตัวอักษร
  const allCats = Array.from(new Set([...DEFAULT_CATS, ...items.map(m => m.category)])).sort();
  const CATS = ["ทั้งหมด", ...allCats];

  const filtered = cat === "ทั้งหมด" ? items : items.filter(m => m.category === cat);
  const availCount = items.filter(m => m.available).length;

  if (checkingSession) return (
    <div style={{ minHeight: "100dvh", background: C.bg }} />
  );

  if (!unlocked) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "Sarabun, sans-serif", padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>จัดการเมนู</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 32 }}>ใส่ PIN เพื่อเข้าใช้งาน</div>
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: pin.length > i ? (pinError ? C.red : C.green) : C.border, transition: "background .15s" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 240, width: "100%" }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n, i) => (
          <button key={i}
            onClick={() => {
              if (n === "⌫") setPin(p => p.slice(0,-1));
              else if (n !== "") handlePin(pin + String(n));
            }}
            style={{ padding: "18px 0", border: `1px solid ${C.border}`, borderRadius: 12, background: n === "" ? "transparent" : "#fff", fontSize: 20, fontWeight: 600, cursor: n === "" ? "default" : "pointer", color: C.text, fontFamily: "Sarabun, sans-serif" }}>
            {n}
          </button>
        ))}
      </div>
      {pinError && <div style={{ color: C.red, fontSize: 13, marginTop: 16, fontWeight: 600 }}>PIN ไม่ถูกต้อง</div>}
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "Sarabun, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", padding: "10px 24px", borderRadius: "0 0 14px 14px", fontSize: 13, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap" }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, background: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>🍽️ จัดการเมนู</div>
            <div style={{ fontSize: 11, color: C.muted }}>เปิดใช้งาน {availCount}/{items.length} รายการ</div>
          </div>
          <button onClick={handleLock} style={{ padding: "5px 10px", background: C.redL, border: `1px solid #F5B4AE`, borderRadius: 20, fontSize: 11, fontWeight: 600, color: C.red, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>🔒 ล็อก</button>
        </div>
      </div>

      {/* ประกาศแจ้งเตือน */}
      <div style={{ margin: "12px 16px 0", padding: "12px 14px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>📢 ประกาศถึงลูกค้าทุกคน</div>
        <button onClick={quickAnnounce} disabled={annSending}
          style={{ width: "100%", padding: "10px", background: C.green, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: annSending ? "not-allowed" : "pointer", fontFamily: "Sarabun, sans-serif", marginBottom: 8 }}>
          {annSending ? "กำลังส่ง..." : "🔔 แจ้ง \"เมนูวันนี้อัปเดตแล้ว\""}
        </button>
        {!showAnn ? (
          <button onClick={() => setShowAnn(true)} style={{ width: "100%", padding: "8px", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            ✏️ เขียนประกาศเอง
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input value={annText} onChange={e => setAnnText(e.target.value)} placeholder="พิมพ์ข้อความประกาศ..."
              style={{ padding: "8px 12px", border: `1.5px solid ${C.green}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif", outline: "none" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleAnnounce} disabled={annSending} style={{ flex: 1, padding: "8px", background: C.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>ส่ง</button>
              <button onClick={() => setShowAnn(false)} style={{ flex: 1, padding: "8px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>ยกเลิก</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 16px", overflowX: "auto", scrollbarWidth: "none", alignItems: "center" }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: cat === c ? "none" : `1px solid ${C.border}`, background: cat === c ? C.green : "transparent", color: cat === c ? "#fff" : C.muted, fontFamily: "Sarabun, sans-serif" }}>
            {c}
          </button>
        ))}
        <button onClick={() => setShowAdd(true)}
          style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer", border: "none", background: C.amber, color: "#fff", fontFamily: "Sarabun, sans-serif", marginLeft: "auto", flexShrink: 0 }}>
          + เพิ่มเมนู
        </button>
      </div>

      {showAdd && (
        <div style={{ margin: "0 16px 12px", padding: "14px", background: "#fff", border: `1.5px solid ${C.amber}`, borderRadius: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🍽️ เมนูใหม่</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🍽️"
                style={{ width: 50, padding: "8px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 16, textAlign: "center", fontFamily: "Sarabun, sans-serif" }} />
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อเมนู"
                style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="ราคา"
                style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif" }} />
              {!newCatCustom ? (
                <select value={newCat} onChange={e => {
                  if (e.target.value === "__custom__") { setNewCatCustom(true); setNewCatText(""); }
                  else setNewCat(e.target.value);
                }}
                  style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif" }}>
                  {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ หมวดใหม่...</option>
                </select>
              ) : (
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  <input value={newCatText} onChange={e => setNewCatText(e.target.value)}
                    placeholder="พิมพ์ชื่อหมวดใหม่" autoFocus
                    style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${C.amber}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif" }} />
                  <button onClick={() => { setNewCatCustom(false); setNewCatText(""); }}
                    style={{ padding: "0 10px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, cursor: "pointer", fontSize: 12 }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
            <input value={newIng} onChange={e => setNewIng(e.target.value)} placeholder="วัตถุดิบ (ถ้ามี)"
              style={{ padding: "8px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleAddMenu} disabled={adding}
                style={{ flex: 1, padding: "9px", background: C.amber, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                {adding ? "กำลังเพิ่ม..." : "เพิ่มเมนู"}
              </button>
              <button onClick={() => setShowAdd(false)}
                style={{ flex: 1, padding: "9px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: C.muted }}>กำลังโหลด...</div>
        ) : filtered.map(item => (
          <div key={item.id} style={{ background: "#fff", border: `1px solid ${item.available ? C.border : "#F5B4AE"}`, borderRadius: 14, padding: "12px 14px", opacity: item.available ? 1 : 0.7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {item.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{item.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{item.price} บาท</span>
                  <button onClick={() => editing === item.id ? setEditing(null) : openEdit(item)}
                    style={{ fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                    ✏️ แก้ไข
                  </button>
                </div>
                {(item as any).ingredients && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>🧂 {(item as any).ingredients}</div>
                )}
              </div>
              <button
                onClick={() => handleToggle(item)}
                disabled={saving === item.id}
                style={{ padding: "8px 14px", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: saving === item.id ? "not-allowed" : "pointer", background: item.available ? C.green : C.redL, color: item.available ? "#fff" : C.red, flexShrink: 0, fontFamily: "Sarabun, sans-serif", minWidth: 64 }}>
                {saving === item.id ? "..." : item.available ? "เปิด" : "ปิด"}
              </button>
            </div>

            {editing === item.id && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>ชื่อเมนู</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${C.green}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif", outline: "none", marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>ราคา (บาท)</label>
                  <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${C.green}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif", outline: "none", marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>วัตถุดิบ</label>
                  <input value={editIng} onChange={e => setEditIng(e.target.value)} placeholder="เช่น หมูสับ, กระเพรา, พริก"
                    style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${C.green}`, borderRadius: 8, fontSize: 13, fontFamily: "Sarabun, sans-serif", outline: "none", marginTop: 4 }} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => handleSave(item)} disabled={saving === item.id}
                    style={{ flex: 1, padding: "9px", background: C.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                    บันทึก
                  </button>
                  <button onClick={() => setEditing(null)}
                    style={{ flex: 1, padding: "9px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                    ยกเลิก
                  </button>
                  <button onClick={() => setDeleteConfirm(item.id)}
                    style={{ padding: "9px 14px", background: C.redL, color: C.red, border: `1px solid #F5B4AE`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                    🗑 ลบ
                  </button>
                </div>

                {deleteConfirm === item.id && (
                  <div style={{ marginTop: 10, padding: "12px", background: C.redL, borderRadius: 10, border: `1px solid #F5B4AE` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 8 }}>
                      ⚠️ ลบ &quot;{item.name}&quot; ถาวร? ลบแล้วกู้คืนไม่ได้
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleDelete(item)}
                        style={{ flex: 1, padding: "8px", background: C.red, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                        ยืนยันลบ
                      </button>
                      <button onClick={() => setDeleteConfirm(null)}
                        style={{ flex: 1, padding: "8px", background: "#fff", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                        ไม่ลบ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
