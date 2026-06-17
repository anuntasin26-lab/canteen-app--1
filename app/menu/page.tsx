"use client";
// ─── app/menu/page.tsx ────────────────────────────────────
// fix bug 3: เพิ่ม realtime subscription เมนู

import { useEffect, useState } from "react";
import { getMenuItems, toggleMenuItem, updateMenuPrice, subscribeToMenuItems, supabase } from "@/lib/supabase";
import type { MenuItem } from "@/types";

const MENU_PIN = process.env.NEXT_PUBLIC_KITCHEN_PIN ?? "1234";

const C = {
  green: "#3B6B0F", greenL: "#EBF3DC", greenB: "#B5D47A",
  red: "#C0392B", redL: "#FDECEA",
  text: "#1C1A17", muted: "#7A7570", border: "#E2DDD6", bg: "#F5F3EE",
  amber: "#C97A14", amberL: "#FEF3DC",
};

const CATS = ["ทั้งหมด", "ข้าว", "ก๋วยเตี๋ยว", "เครื่องดื่ม"];

export default function MenuPage() {
  const [pin,      setPin]      = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [items,    setItems]    = useState<MenuItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [cat,      setCat]      = useState("ทั้งหมด");
  const [editing,  setEditing]  = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [saving,   setSaving]   = useState<number | null>(null);
  const [toast,    setToast]    = useState("");

  const handlePin = (p: string) => {
    setPin(p);
    if (p.length === 4) {
      if (p === MENU_PIN) { setUnlocked(true); setPinError(false); }
      else { setPinError(true); setTimeout(() => { setPin(""); setPinError(false); }, 800); }
    }
  };

  useEffect(() => {
    if (!unlocked) return;
    getMenuItems()
      .then(d => setItems(d as MenuItem[]))
      .finally(() => setLoading(false));
  }, [unlocked]);

  // fix bug 3: realtime sync เมนู
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
    } catch { alert("เกิดข้อผิดพลาด"); }
    finally { setSaving(null); }
  };

  const handlePriceSave = async (item: MenuItem) => {
    const p = parseInt(newPrice);
    if (!p || p <= 0) { alert("ราคาไม่ถูกต้อง"); return; }
    setSaving(item.id);
    try {
      await updateMenuPrice(item.id, p);
      setItems(prev => prev.map(m => m.id === item.id ? { ...m, price: p } : m));
      setEditing(null);
      showToast(`อัปเดตราคา "${item.name}" เป็น ${p} บาท`);
    } catch { alert("เกิดข้อผิดพลาด"); }
    finally { setSaving(null); }
  };

  const filtered = cat === "ทั้งหมด" ? items : items.filter(m => m.category === cat);
  const availCount = items.filter(m => m.available).length;

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
          <button onClick={() => setUnlocked(false)} style={{ padding: "5px 10px", background: C.redL, border: `1px solid #F5B4AE`, borderRadius: 20, fontSize: 11, fontWeight: 600, color: C.red, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>🔒 ล็อก</button>
        </div>
      </div>
      <div style={{ margin: "10px 16px 0", padding: "10px 14px", background: C.amberL, borderRadius: 10, fontSize: 12, color: C.amber, fontWeight: 600 }}>
        💡 กด "เปิด/ปิด" เพื่ออัปเดตเมนูวันนี้ — ลูกค้าเห็นผลทันที
      </div>
      <div style={{ display: "flex", gap: 6, padding: "12px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: cat === c ? "none" : `1px solid ${C.border}`, background: cat === c ? C.green : "transparent", color: cat === c ? "#fff" : C.muted, fontFamily: "Sarabun, sans-serif" }}>
            {c}
          </button>
        ))}
      </div>
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: C.muted }}>กำลังโหลด...</div>
        ) : filtered.map(item => (
          <div key={item.id} style={{ background: "#fff", border: `1px solid ${item.available ? C.border : "#F5B4AE"}`, borderRadius: 14, padding: "12px 14px", opacity: item.available ? 1 : 0.75 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{item.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{item.name}</div>
                {editing === item.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                      placeholder={String(item.price)}
                      style={{ width: 80, padding: "4px 8px", border: `1.5px solid ${C.green}`, borderRadius: 8, fontSize: 14, fontFamily: "Sarabun, sans-serif", color: C.text, outline: "none" }} autoFocus />
                    <span style={{ fontSize: 12, color: C.muted }}>บาท</span>
                    <button onClick={() => handlePriceSave(item)} disabled={saving === item.id}
                      style={{ padding: "4px 10px", background: C.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>บันทึก</button>
                    <button onClick={() => setEditing(null)}
                      style={{ padding: "4px 10px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>ยกเลิก</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{item.price} บาท</span>
                    <button onClick={() => { setEditing(item.id); setNewPrice(String(item.price)); }}
                      style={{ fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>✏️ แก้ราคา</button>
                  </div>
                )}
              </div>
              <button onClick={() => handleToggle(item)} disabled={saving === item.id}
                style={{ padding: "8px 14px", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: saving === item.id ? "not-allowed" : "pointer", background: item.available ? C.green : C.redL, color: item.available ? "#fff" : C.red, flexShrink: 0, fontFamily: "Sarabun, sans-serif", minWidth: 64, transition: "all .15s" }}>
                {saving === item.id ? "..." : item.available ? "เปิด" : "ปิด"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
