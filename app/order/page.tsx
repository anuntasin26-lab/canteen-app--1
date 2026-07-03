"use client";

// ─── app/order/page.tsx ───────────────────────────────────
//  เพิ่ม: localStorage persist, แก้ชื่อ, ยกเลิกออเดอร์
// ─────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getDepartmentById,
  getAllDepartments,
  getMenuItems,
  createOrder,
  addItemsToOrder,
  getTodayAnnouncement,
  subscribeToAnnouncements,
  createCustomOrder,
  supabase,
} from "@/lib/supabase";
import type { Department, MenuItem, Order, OrderItem } from "@/types";

// ── localStorage keys ─────────────────────────────────────
const LS_NAME     = "petpal_name";
const LS_ORDER_ID = "petpal_order_id";
const LS_SCREEN   = "petpal_screen"; // จำว่าค้างอยู่หน้าไหน (menu/cart/custom) เพื่อ restore ตอน refresh

const S = {
  app: {
    maxWidth: 420, margin: "0 auto", minHeight: "100dvh",
    background: "#fff", fontFamily: "Sarabun, sans-serif",
    display: "flex", flexDirection: "column" as const,
  },
  topbar: {
    padding: "14px 18px 10px", borderBottom: "1px solid #E2DDD6",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky" as const, top: 0, background: "#fff", zIndex: 10,
  },
  title: { fontSize: 16, fontWeight: 700, color: "#1C1A17" },
  sub:   { fontSize: 11, color: "#7A7570", marginTop: 1 },
  badge: {
    background: "#EBF3DC", color: "#3B6B0F", fontSize: 11, fontWeight: 600,
    padding: "3px 10px", borderRadius: 20, border: "1px solid #B5D47A",
  },
};

// ── Inner component ───────────────────────────────────────
function OrderFlow() {
  const params  = useSearchParams();
  const deptId  = params.get("dept") ?? ""; // ยังรองรับ URL เดิมไว้ด้วย

  const [dept,        setDept]        = useState<Department | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [menuItems,   setMenuItems]   = useState<MenuItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [screen,      setScreen]      = useState<"name"|"menu"|"cart"|"status"|"custom"|"custom_done">("name");
  const [customItems,  setCustomItems]  = useState("");
  const [customNote,   setCustomNote]   = useState("");
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [name,        setName]        = useState("");
  const [cart,        setCart]        = useState<Record<number, number>>({});
  const [note,        setNote]        = useState("");
  const [cat,         setCat]         = useState("ทั้งหมด");
  const [order,       setOrder]       = useState<Order | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [announcement,  setAnnouncement]  = useState<string | null>(null);
  const [showBanner,    setShowBanner]    = useState(false);

  // ── ฟีเจอร์แก้ชื่อ ────────────────────────────────────
  const [editingName,  setEditingName]  = useState(false);
  const [newName,      setNewName]      = useState("");
  const [savingName,   setSavingName]   = useState(false);

  // ── ฟีเจอร์ยกเลิก ─────────────────────────────────────
  const [cancelling,   setCancelling]   = useState(false);

  // ── โหลด dept + menu + ตรวจ localStorage ──────────────
  useEffect(() => {
    // รองรับทั้ง URL เดิม (?dept=xxx) และ URL ใหม่ (ไม่มี dept)
    if (!deptId) {
      // โหลดรายชื่อแผนกทั้งหมด ให้ user เลือกเอง
      Promise.all([getAllDepartments(), getMenuItems()])
        .then(([depts, m]) => {
          setDepartments(depts as Department[]);
          setMenuItems(m as MenuItem[]);
        })
        .catch(() => setError("โหลดข้อมูลไม่ได้ กรุณาลองใหม่"))
        .finally(() => setLoading(false));
      return;
    }

    const savedName    = localStorage.getItem(LS_NAME) ?? "";
    const savedOrderId = localStorage.getItem(LS_ORDER_ID);
    const savedScreen  = localStorage.getItem(LS_SCREEN); // "menu" | "cart" | "custom" | null

    Promise.all([getDepartmentById(deptId), getMenuItems()])
      .then(async ([d, m]) => {
        setDept(d);
        setMenuItems(m);

        // ถ้ามีชื่อค้างไว้ → ใส่ชื่อกลับมา
        if (savedName) setName(savedName);

        // ถ้ามี orderId ค้างไว้ → โหลด order กลับมาแสดงหน้า status
        // (ลำดับความสำคัญสูงสุด — ออร์เดอร์ที่รออยู่ต้องมาก่อนเสมอ)
        let restoredToOrder = false;
        if (savedOrderId) {
          try {
            const { data, error: oErr } = await supabase
              .from("orders")
              .select("*")
              .eq("id", Number(savedOrderId))
              .single();

            if (!oErr && data) {
              // ตรวจว่า order ยังเป็นของวันนี้อยู่
              const orderDate = new Date(data.created_at);
              const today     = new Date();
              const sameDay   =
                orderDate.getFullYear() === today.getFullYear() &&
                orderDate.getMonth()    === today.getMonth()    &&
                orderDate.getDate()     === today.getDate();

              if (sameDay && data.status !== "cancelled") {
                setOrder(data);
                setScreen("status");
                restoredToOrder = true;
              } else {
                // order เก่าแล้ว หรือถูกยกเลิกแล้ว → ล้าง
                localStorage.removeItem(LS_ORDER_ID);
              }
            } else {
              localStorage.removeItem(LS_ORDER_ID);
            }
          } catch {
            localStorage.removeItem(LS_ORDER_ID);
          }
        }

        // ไม่มี order ค้าง แต่มีชื่อ + เคยอยู่หน้า menu/cart/custom
        // → restore กลับไปหน้านั้น ไม่ดีดกลับไปหน้ากรอกชื่อ (fix #2)
        if (!restoredToOrder && savedName && savedScreen &&
            (savedScreen === "menu" || savedScreen === "cart" || savedScreen === "custom")) {
          setScreen(savedScreen);
        }
      })
      .catch(() => setError("โหลดข้อมูลไม่ได้ กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, [deptId]);

  // ── ประกาศ realtime ────────────────────────────────────
  useEffect(() => {
    getTodayAnnouncement().then(a => {
      if (a) { setAnnouncement(a.message); setShowBanner(true); }
    });
    const ch = subscribeToAnnouncements((payload) => {
      setAnnouncement(payload.new.message);
      setShowBanner(true);
    });
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── realtime ติดตาม order ────────────────────────────
  useEffect(() => {
    if (!order) return;
    const ch = supabase
      .channel(`order-${order.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: `id=eq.${order.id}`,
      }, (payload) => {
        setOrder((prev) => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [order?.id]);

  const CATS     = ["ทั้งหมด", ...Array.from(new Set(menuItems.map((m) => m.category)))];
  const filtered = cat === "ทั้งหมด" ? menuItems : menuItems.filter((m) => m.category === cat);
  const cartItems = menuItems.filter((m) => (cart[m.id] ?? 0) > 0);
  const total     = cartItems.reduce((s, m) => s + m.price * cart[m.id], 0);
  const itemCount = Object.values(cart).reduce((s, v) => s + v, 0);

  const add = (id: number) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: number) =>
    setCart((c) => {
      const n = { ...c, [id]: (c[id] ?? 1) - 1 };
      if (n[id] <= 0) delete n[id];
      return n;
    });

  // ── ส่งออเดอร์ตามสั่ง ─────────────────────────────────
  const handleCustomSubmit = async () => {
    if (!customItems.trim() || !dept || !name.trim()) return;
    setCustomSubmitting(true);
    try {
      await createCustomOrder({
        dept_id: dept.id,
        customer_name: name.trim(),
        items: customItems.trim(),
        note: customNote.trim() || undefined,
      });
      setCustomItems("");
      setCustomNote("");
      setScreen("custom_done");
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setCustomSubmitting(false);
    }
  };

  // ── บันทึกชื่อแล้วไปหน้า menu ─────────────────────────
  const handleGoMenu = () => {
    localStorage.setItem(LS_NAME, name.trim());
    localStorage.setItem(LS_SCREEN, "menu");
    setScreen("menu");
  };

  // ── ไปหน้าใดก็ได้ที่ "ผ่านขั้นกรอกชื่อแล้ว" พร้อมจำไว้ใน
  //     localStorage เพื่อ restore ตอน refresh (ปัญหา #2)
  //     ใช้แทน setScreen("menu"/"cart"/"custom") ตรงๆ ทุกจุด
  const goTo = (s: "menu" | "cart" | "custom") => {
    localStorage.setItem(LS_SCREEN, s);
    setScreen(s);
  };

  // ── ยืนยันสั่งอาหาร ────────────────────────────────────
  const handleConfirm = async () => {
    if (!dept || !name.trim() || cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const items: OrderItem[] = cartItems.map((m) => ({
        id: m.id, name: m.name, qty: cart[m.id], price: m.price,
      }));

      // กรณี "สั่งอาหารเพิ่ม": ถ้ามีออร์เดอร์เดิมอยู่ใน state และยังสถานะ "new"
      // ให้รวมรายการเข้าออร์เดอร์เดิม แทนการสร้างใบใหม่
      if (order && order.status === "new") {
        try {
          const updated = await addItemsToOrder(
            order.id,
            items,
            note.trim() || undefined
          );
          setOrder(updated);
          setScreen("status");
          setCart({});
          setNote("");
          return;
        } catch (mergeErr: any) {
          // ออร์เดอร์เดิมเริ่มทำไปแล้วระหว่างที่กำลังเลือกเมนูเพิ่ม
          // → สร้างออร์เดอร์ใหม่แยกแทน ไม่ block ผู้ใช้
          if (mergeErr?.code !== "ORDER_ALREADY_STARTED") throw mergeErr;
        }
      }

      // กรณีสั่งครั้งแรก หรือออร์เดอร์เดิมเริ่มทำไปแล้ว → สร้างใบใหม่
      const newOrder = await createOrder({
        dept_id: dept.id,
        customer_name: name.trim(),
        items,
        note: note.trim() || undefined,
        total,
      });
      localStorage.setItem(LS_ORDER_ID, String(newOrder.id));
      setOrder(newOrder);
      setScreen("status");
      setCart({});
      setNote("");
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  // ── แก้ไขชื่อหลังสั่งแล้ว ──────────────────────────────
  const handleSaveName = async () => {
    if (!order || !newName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ customer_name: newName.trim() })
        .eq("id", order.id);
      if (error) throw error;
      setOrder((prev) => prev ? { ...prev, customer_name: newName.trim() } : prev);
      localStorage.setItem(LS_NAME, newName.trim());
      setName(newName.trim());
      setEditingName(false);
    } catch {
      alert("แก้ไขชื่อไม่ได้ กรุณาลองใหม่");
    } finally {
      setSavingName(false);
    }
  };

  // ── ยกเลิกออเดอร์ (เฉพาะ status = new) ───────────────
  const handleCancel = async () => {
    if (!order) return;
    const confirmed = window.confirm("ยืนยันยกเลิกออเดอร์นี้?");
    if (!confirmed) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      if (error) throw error;
      // ล้าง localStorage แล้วกลับหน้าเมนู
      localStorage.removeItem(LS_ORDER_ID);
      setOrder(null);
      setCart({});
      setNote("");
      goTo("menu");
    } catch {
      alert("ยกเลิกไม่ได้ กรุณาลองใหม่");
    } finally {
      setCancelling(false);
    }
  };

  // ── สั่งเพิ่ม ───────────────────────────────────────────
  // เก็บออร์เดอร์เดิมไว้ (ไม่ลบ localStorage) เพื่อให้ตอนยืนยัน
  // รายการใหม่ไปรวมกับออร์เดอร์เดิมที่ยังสถานะ "new"
  // ถ้าออร์เดอร์เดิมเริ่มทำไปแล้ว (cooking/done) handleConfirm
  // จะตรวจพบเองและสร้างออร์เดอร์ใหม่แทน
  const handleReorder = () => {
    setCart({});
    setNote("");
    goTo("menu");
  };

  // ── Loading / Error ────────────────────────────────────
  if (loading) return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#7A7570" }}>กำลังโหลด...</p>
    </div>
  );
  // ถ้าไม่มี deptId ใน URL = user ยังไม่ได้เลือกแผนก → ไม่ error แค่รอ
  if (error) return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ color: "#C0392B", textAlign: "center" }}>{error}</p>
    </div>
  );
  if (!dept && deptId) return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ color: "#C0392B", textAlign: "center" }}>ไม่พบข้อมูลแผนก</p>
    </div>
  );

  // ── NAME ──────────────────────────────────────────────
  if (screen === "name") return (
    <div style={S.app}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 24px", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1A17", marginBottom: 8 }}>สั่งอาหารได้เลย</div>
          {dept && <span style={S.badge}>แผนก{dept.name}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* ถ้าไม่มี dept จาก URL → แสดง dropdown เลือกแผนก */}
          {!deptId && departments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#7A7570", letterSpacing: ".04em", textTransform: "uppercase" as const }}>
                แผนกของคุณ
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => handleSelectDept(e.target.value)}
                style={{ padding: "14px 16px", border: "1.5px solid #E2DDD6", borderRadius: 12, fontSize: 15, fontFamily: "Sarabun, sans-serif", background: "#F5F3EE", color: selectedDeptId ? "#1C1A17" : "#7A7570", outline: "none", appearance: "none" as const }}
              >
                <option value="">— เลือกแผนก —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7A7570", letterSpacing: ".04em", textTransform: "uppercase" as const }}>
            ชื่อของคุณ
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && dept && handleGoMenu()}
            placeholder="เช่น สมชาย, วิไล..."
            autoFocus
            style={{ padding: "14px 16px", border: "1.5px solid #E2DDD6", borderRadius: 12, fontSize: 16, fontFamily: "Sarabun, sans-serif", background: "#F5F3EE", outline: "none" }}
          />
          <button
            disabled={!name.trim() || !dept}
            onClick={handleGoMenu}
            style={{ padding: 14, background: (name.trim() && dept) ? "#3B6B0F" : "#E2DDD6", color: (name.trim() && dept) ? "#fff" : "#7A7570", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: (name.trim() && dept) ? "pointer" : "not-allowed", fontFamily: "Sarabun, sans-serif" }}
          >
            ดูเมนู →
          </button>
        </div>
      </div>
    </div>
  );

  // ── MENU ──────────────────────────────────────────────
  if (screen === "menu") return (
    <div style={S.app}>
      <div style={S.topbar}>
        <button onClick={() => order ? setScreen("status") : (localStorage.removeItem(LS_SCREEN), setScreen("name"))} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #E2DDD6", background: "#F5F3EE", cursor: "pointer", fontSize: 16 }}>←</button>
        <div>
          <div style={S.title}>สวัสดี, {name}</div>
          <div style={S.sub}>แผนก{dept.name}</div>
        </div>
        <span style={S.badge}>{dept.name}</span>
      </div>
      {showBanner && announcement && (
        <div style={{ margin: "10px 16px 0", padding: "10px 14px", background: "#FEF3DC", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#C97A14", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>📢 {announcement}</span>
          <button onClick={() => setShowBanner(false)} style={{ background: "transparent", border: "none", color: "#C97A14", fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", borderBottom: "1px solid #E2DDD6", position: "sticky", top: 57, background: "#fff", zIndex: 9 }}>
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: cat === c ? "none" : "1.5px solid #E2DDD6", background: cat === c ? "#3B6B0F" : "transparent", color: cat === c ? "#fff" : "#7A7570", fontFamily: "Sarabun, sans-serif" }}>
            {c}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {filtered.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid #E2DDD6", borderRadius: 14, opacity: m.available ? 1 : 0.45, pointerEvents: m.available ? "auto" : "none" }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: "#F5F3EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{m.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1A17" }}>
                {m.name}
                {!m.available && <span style={{ fontSize: 10, fontWeight: 700, color: "#C0392B", background: "#FDECEA", padding: "2px 7px", borderRadius: 6, marginLeft: 6 }}>หมด</span>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3B6B0F" }}>{m.price} บาท</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(cart[m.id] ?? 0) > 0 ? (
                <>
                  <button onClick={() => sub(m.id)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #E2DDD6", background: "transparent", cursor: "pointer", fontSize: 16 }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 18, textAlign: "center" }}>{cart[m.id]}</span>
                  <button onClick={() => add(m.id)} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#3B6B0F", color: "#fff", cursor: "pointer", fontSize: 18 }}>+</button>
                </>
              ) : (
                <button onClick={() => add(m.id)} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#3B6B0F", color: "#fff", cursor: "pointer", fontSize: 18 }}>+</button>
              )}
            </div>
          </div>
        ))}
        {itemCount > 0 && <div style={{ height: 64 }} />}
      </div>
      {itemCount > 0 && (
        <div onClick={() => goTo("cart")} style={{ margin: "10px 16px 0", padding: "14px 16px", background: "#3B6B0F", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            🛒 ดูตะกร้า
            <span style={{ background: "#fff", color: "#3B6B0F", fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 10, marginLeft: 8 }}>{itemCount}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{total} บาท</span>
        </div>
      )}
      {/* ปุ่มสั่งตามสั่ง */}
      <div style={{ margin: itemCount > 0 ? "8px 16px 14px" : "10px 16px 14px", padding: "13px 16px", background: "#FEF3DC", border: "1.5px solid #F2CD8F", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => goTo("custom")}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#A8650E" }}>✏️ สั่งอาหารตามสั่ง</span>
        <span style={{ fontSize: 13, color: "#A8650E" }}>พิมพ์เองได้ →</span>
      </div>
    </div>
  );

  // ── CART ──────────────────────────────────────────────
  if (screen === "cart") return (
    <div style={S.app}>
      <div style={S.topbar}>
        <button onClick={() => goTo("menu")} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #E2DDD6", background: "#F5F3EE", cursor: "pointer", fontSize: 16 }}>←</button>
        <div style={S.title}>ตะกร้า</div>
        <div style={{ width: 30 }} />
      </div>
      <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {cartItems.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #E2DDD6", borderRadius: 12 }}>
            <span style={{ fontSize: 20 }}>{m.emoji}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => sub(m.id)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid #E2DDD6", background: "transparent", cursor: "pointer" }}>−</button>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{cart[m.id]}</span>
              <button onClick={() => add(m.id)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "#3B6B0F", color: "#fff", cursor: "pointer" }}>+</button>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#3B6B0F", whiteSpace: "nowrap" }}>{m.price * cart[m.id]}฿</span>
          </div>
        ))}
        <label style={{ fontSize: 12, fontWeight: 600, color: "#7A7570", letterSpacing: ".04em", textTransform: "uppercase" as const }}>หมายเหตุ (ถ้ามี)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น ไม่ใส่ผัก, เผ็ดน้อย..."
          rows={2}
          style={{ padding: "12px 14px", border: "1.5px solid #E2DDD6", borderRadius: 12, fontSize: 14, fontFamily: "Sarabun, sans-serif", background: "#F5F3EE", resize: "none", outline: "none" }}
        />
        <div style={{ border: "1px solid #E2DDD6", borderRadius: 12, overflow: "hidden" }}>
          {[["ชื่อผู้สั่ง", name], ["แผนก", dept.name], ["รวมทั้งหมด", `${total} บาท`]].map(([label, val], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", fontSize: i === 2 ? 14 : 13, fontWeight: i === 2 ? 700 : 400, borderBottom: i < 2 ? "1px solid #E2DDD6" : "none" }}>
              <span style={{ color: "#7A7570" }}>{label}</span>
              <span style={{ color: i === 2 ? "#3B6B0F" : "#1C1A17", fontWeight: i === 2 ? 700 : 500 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        <button
          disabled={submitting}
          onClick={handleConfirm}
          style={{ width: "100%", padding: 14, background: submitting ? "#E2DDD6" : "#3B6B0F", color: submitting ? "#7A7570" : "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "Sarabun, sans-serif" }}
        >
          {submitting ? "กำลังส่ง..." : "ยืนยันการสั่งอาหาร"}
        </button>
      </div>
    </div>
  );

  // ── CUSTOM ORDER ──────────────────────────────────────
  if (screen === "custom") return (
    <div style={S.app}>
      <div style={S.topbar}>
        <button onClick={() => goTo("menu")} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #E2DDD6", background: "#F5F3EE", cursor: "pointer", fontSize: 16 }}>←</button>
        <div>
          <div style={S.title}>สั่งตามสั่ง</div>
          <div style={S.sub}>{name} · แผนก{dept?.name}</div>
        </div>
        <span style={S.badge}>{dept?.name}</span>
      </div>
      <div style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ padding: "14px 16px", background: "#FEF3DC", borderRadius: 14, fontSize: 13, color: "#A8650E", fontWeight: 600 }}>
          ✏️ พิมพ์รายการอาหารที่ต้องการ เช่น "ข้าวผัดกระเพราหมูสับไข่ดาว"
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#7A7570", letterSpacing: ".04em" }}>รายการอาหาร *</label>
          <textarea
            value={customItems}
            onChange={e => setCustomItems(e.target.value)}
            placeholder={"เช่น ข้าวผัดกระเพราหมูสับไข่ดาว\nต้มยำกุ้งน้ำข้น 1 ที่\nน้ำเปล่า 1 ขวด"}
            rows={5}
            autoFocus
            style={{ padding: "12px 14px", border: "1.5px solid #F2CD8F", borderRadius: 12, fontSize: 14, fontFamily: "Sarabun, sans-serif", background: "#FFFDF5", resize: "none", outline: "none", lineHeight: 1.7 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#7A7570", letterSpacing: ".04em" }}>หมายเหตุ (ถ้ามี)</label>
          <input
            value={customNote}
            onChange={e => setCustomNote(e.target.value)}
            placeholder="เช่น ไม่เผ็ด, แยกน้ำ"
            style={{ padding: "12px 14px", border: "1.5px solid #E2DDD6", borderRadius: 12, fontSize: 14, fontFamily: "Sarabun, sans-serif", background: "#F5F3EE", outline: "none" }}
          />
        </div>
        <div style={{ border: "1px solid #E2DDD6", borderRadius: 12, overflow: "hidden" }}>
          {[["ชื่อผู้สั่ง", name], ["แผนก", dept?.name ?? ""]].map(([label, val], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", fontSize: 13, borderBottom: i < 1 ? "1px solid #E2DDD6" : "none" }}>
              <span style={{ color: "#7A7570" }}>{label}</span>
              <span style={{ color: "#1C1A17", fontWeight: 500 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        <button
          disabled={!customItems.trim() || customSubmitting}
          onClick={handleCustomSubmit}
          style={{ width: "100%", padding: 14, background: customItems.trim() ? "#A8650E" : "#E2DDD6", color: customItems.trim() ? "#fff" : "#7A7570", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: customItems.trim() ? "pointer" : "not-allowed", fontFamily: "Sarabun, sans-serif" }}>
          {customSubmitting ? "กำลังส่ง..." : "✉️ ส่งรายการให้ครัว"}
        </button>
      </div>
    </div>
  );

  // ── CUSTOM DONE ────────────────────────────────────────
  if (screen === "custom_done") return (
    <div style={S.app}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 16, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#FEF3DC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>✉️</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1A17" }}>ส่งรายการให้ครัวแล้ว!</div>
        <div style={{ fontSize: 14, color: "#7A7570" }}>ครัวจะรับทราบรายการของคุณในไม่ช้า</div>
        <div style={{ padding: "12px 20px", background: "#F5F3EE", borderRadius: 14, fontSize: 13, color: "#5C5852", textAlign: "left", width: "100%", lineHeight: 1.8 }}>
          👤 {name} · แผนก{dept?.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          <button onClick={() => goTo("custom")}
            style={{ width: "100%", padding: 13, background: "#A8650E", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            ✏️ สั่งเพิ่มอีก
          </button>
          <button onClick={() => goTo("menu")}
            style={{ width: "100%", padding: 13, background: "#F5F3EE", color: "#3B6B0F", border: "1px solid #B5D47A", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            กลับหน้าเมนู
          </button>
        </div>
      </div>
    </div>
  );

  // ── STATUS ────────────────────────────────────────────
  const statusMeta = {
    new:       { icon: "📋", title: "ออร์เดอร์ถูกส่งแล้ว", sub: "รอร้านรับออร์เดอร์",     bg: "#EEF2FF" },
    cooking:   { icon: "👨‍🍳", title: "กำลังปรุงอาหาร",     sub: "ประมาณ 10–15 นาที",      bg: "#FEF3DC" },
    done:      { icon: "✅", title: "อาหารพร้อมแล้ว!",    sub: "รับที่เคาน์เตอร์ได้เลย",  bg: "#EBF3DC" },
    cancelled: { icon: "❌", title: "ยกเลิกแล้ว",         sub: "",                         bg: "#FDECEA" },
  };
  const sm = statusMeta[(order?.status as keyof typeof statusMeta) ?? "new"];
  const canCancel   = order?.status === "new";
  const canEditName = order?.status === "new" || order?.status === "cooking";

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div>
          <div style={S.title}>สถานะออร์เดอร์</div>
          <div style={S.sub}>#{String(order?.id).padStart(4, "0")} · {order?.customer_name}</div>
        </div>
        <span style={{ ...S.badge, background: sm.bg }}>
          {order?.status === "done" ? "เสร็จแล้ว" : order?.status === "cooking" ? "กำลังทำ" : order?.status === "cancelled" ? "ยกเลิก" : "ใหม่"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px 16px", gap: 8, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: sm.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 4 }}>{sm.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{sm.title}</div>
        <div style={{ fontSize: 13, color: "#7A7570" }}>{sm.sub}</div>
      </div>

      {/* ── แก้ไขชื่อ ─────────────────────────────────── */}
      {canEditName && (
        <div style={{ margin: "0 16px 12px", padding: "12px 14px", border: "1px solid #E2DDD6", borderRadius: 12, background: "#F5F3EE" }}>
          {editingName ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#7A7570" }}>แก้ไขชื่อ</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={order?.customer_name}
                autoFocus
                style={{ padding: "10px 12px", border: "1.5px solid #E2DDD6", borderRadius: 10, fontSize: 14, fontFamily: "Sarabun, sans-serif", background: "#fff", outline: "none" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setEditingName(false)}
                  style={{ flex: 1, padding: 10, background: "transparent", color: "#7A7570", border: "1px solid #E2DDD6", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
                >
                  ยกเลิก
                </button>
                <button
                  disabled={!newName.trim() || savingName}
                  onClick={handleSaveName}
                  style={{ flex: 1, padding: 10, background: newName.trim() ? "#3B6B0F" : "#E2DDD6", color: newName.trim() ? "#fff" : "#7A7570", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: newName.trim() ? "pointer" : "not-allowed", fontFamily: "Sarabun, sans-serif" }}
                >
                  {savingName ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#7A7570", marginBottom: 2 }}>ชื่อผู้สั่ง</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{order?.customer_name}</div>
              </div>
              <button
                onClick={() => { setNewName(order?.customer_name ?? ""); setEditingName(true); }}
                style={{ padding: "6px 14px", background: "transparent", color: "#3B6B0F", border: "1px solid #B5D47A", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
              >
                ✏️ แก้ไข
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Progress steps (ซ่อนถ้า cancelled) ─────────── */}
      {order?.status !== "cancelled" && (
        <div style={{ padding: "0 28px 16px" }}>
          {(["new", "cooking", "done"] as const).map((s, i, arr) => {
            const pastDone = (order?.status === "cooking" && i === 0) || order?.status === "done";
            const isFirst  = i === 0;
            const isActive = order?.status === s;
            const labels   = ["ส่งออร์เดอร์แล้ว", "กำลังปรุงอาหาร", "พร้อมเสิร์ฟ"];
            return (
              <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: pastDone || isFirst ? "#3B6B0F" : isActive ? "#FEF3DC" : "#F5F3EE", border: isActive && !isFirst ? "2px solid #C97A14" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: pastDone || isFirst ? "#fff" : isActive ? "#C97A14" : "#7A7570" }}>
                    {pastDone || isFirst ? "✓" : i + 1}
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 2, height: 20, background: pastDone || isFirst ? "#B5D47A" : "#E2DDD6", margin: "2px 0" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isActive || pastDone || isFirst ? "#1C1A17" : "#7A7570" }}>{labels[i]}</div>
                  <div style={{ fontSize: 11, color: "#7A7570", marginBottom: 14 }}>
                    {pastDone || isFirst ? "เสร็จสิ้น" : isActive ? "กำลังดำเนินการ" : "รอดำเนินการ"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── รายการที่สั่ง ─────────────────────────────── */}
      <div style={{ margin: "0 16px 16px", border: "1px solid #E2DDD6", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "#F5F3EE", fontSize: 11, fontWeight: 700, color: "#7A7570", letterSpacing: ".04em", borderBottom: "1px solid #E2DDD6" }}>รายการที่สั่ง</div>
        {order?.items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #E2DDD6" }}>
            <span>{it.name} ×{it.qty}</span>
            <span style={{ color: "#3B6B0F", fontWeight: 700 }}>{it.price * it.qty} บาท</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", fontSize: 14, fontWeight: 700 }}>
          <span style={{ color: "#7A7570" }}>รวม</span>
          <span style={{ color: "#3B6B0F" }}>{order?.total} บาท</span>
        </div>
      </div>

      {/* ── ปุ่มล่าง ──────────────────────────────────── */}
      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 11, color: "#7A7570", textAlign: "center", margin: 0 }}>ชำระเงินที่เคาน์เตอร์หลังรับอาหาร</p>
        <button
          onClick={handleReorder}
          style={{ width: "100%", padding: 12, background: "#F5F3EE", color: "#3B6B0F", border: "1px solid #B5D47A", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
        >
          สั่งอาหารเพิ่ม
        </button>
        {/* ปุ่มยกเลิก — แสดงเฉพาะตอน status = new */}
        {canCancel && (
          <button
            disabled={cancelling}
            onClick={handleCancel}
            style={{ width: "100%", padding: 12, background: cancelling ? "#E2DDD6" : "transparent", color: cancelling ? "#7A7570" : "#C0392B", border: "1px solid #FBBFBF", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: cancelling ? "not-allowed" : "pointer", fontFamily: "Sarabun, sans-serif" }}
          >
            {cancelling ? "กำลังยกเลิก..." : "ยกเลิกออเดอร์"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Outer ──────────────────────────────────────────────────
export default function OrderPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", fontFamily: "Sarabun, sans-serif", color: "#7A7570" }}>
        กำลังโหลด...
      </div>
    }>
      <OrderFlow />
    </Suspense>
  );
}
