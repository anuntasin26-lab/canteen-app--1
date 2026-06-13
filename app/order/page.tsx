"use client";

// ─── app/order/page.tsx ───────────────────────────────────
//  fix: ห่อ useSearchParams() ด้วย <Suspense> (Next.js 14+)
// ─────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getDepartmentById,
  getMenuItems,
  createOrder,
  supabase,
} from "@/lib/supabase";
import type { Department, MenuItem, Order, OrderItem } from "@/types";

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

// ── Inner component (ใช้ useSearchParams ได้ปลอดภัยในนี้) ──
function OrderFlow() {
  const params  = useSearchParams();
  const deptId  = params.get("dept") ?? "";

  const [dept,       setDept]       = useState<Department | null>(null);
  const [menuItems,  setMenuItems]  = useState<MenuItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [screen,     setScreen]     = useState<"name"|"menu"|"cart"|"status">("name");
  const [name,       setName]       = useState("");
  const [cart,       setCart]       = useState<Record<number, number>>({});
  const [note,       setNote]       = useState("");
  const [cat,        setCat]        = useState("ทั้งหมด");
  const [order,      setOrder]      = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // โหลด dept + menu
  useEffect(() => {
    if (!deptId) {
      setError("ไม่พบรหัสแผนก — กรุณาสแกน QR ใหม่");
      setLoading(false);
      return;
    }
    Promise.all([getDepartmentById(deptId), getMenuItems()])
      .then(([d, m]) => { setDept(d); setMenuItems(m); })
      .catch(() => setError("โหลดข้อมูลไม่ได้ กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, [deptId]);

  // realtime ติดตามออร์เดอร์ของตัวเอง
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

  const CATS      = ["ทั้งหมด", ...Array.from(new Set(menuItems.map((m) => m.category)))];
  const filtered  = cat === "ทั้งหมด" ? menuItems : menuItems.filter((m) => m.category === cat);
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

  const handleConfirm = async () => {
    if (!dept || !name.trim() || cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const items: OrderItem[] = cartItems.map((m) => ({
        id: m.id, name: m.name, qty: cart[m.id], price: m.price,
      }));
      const newOrder = await createOrder({
        dept_id: dept.id,
        customer_name: name.trim(),
        items,
        note: note.trim() || undefined,
        total,
      });
      setOrder(newOrder);
      setScreen("status");
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#7A7570" }}>กำลังโหลด...</p>
    </div>
  );
  if (error || !dept) return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ color: "#C0392B", textAlign: "center" }}>{error ?? "ไม่พบข้อมูลแผนก"}</p>
    </div>
  );

  // ── NAME ─────────────────────────────────────────────
  if (screen === "name") return (
    <div style={S.app}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 24px", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1A17", marginBottom: 8 }}>สั่งอาหารได้เลย</div>
          <span style={S.badge}>แผนก{dept.name}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7A7570", letterSpacing: ".04em", textTransform: "uppercase" as const }}>
            ชื่อของคุณ
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && setScreen("menu")}
            placeholder="เช่น สมชาย, วิไล..."
            autoFocus
            style={{ padding: "14px 16px", border: "1.5px solid #E2DDD6", borderRadius: 12, fontSize: 16, fontFamily: "Sarabun, sans-serif", background: "#F5F3EE", outline: "none" }}
          />
          <button
            disabled={!name.trim()}
            onClick={() => setScreen("menu")}
            style={{ padding: 14, background: name.trim() ? "#3B6B0F" : "#E2DDD6", color: name.trim() ? "#fff" : "#7A7570", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "Sarabun, sans-serif" }}
          >
            ดูเมนู →
          </button>
        </div>
      </div>
    </div>
  );

  // ── MENU ─────────────────────────────────────────────
  if (screen === "menu") return (
    <div style={S.app}>
      <div style={S.topbar}>
        <button onClick={() => setScreen("name")} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #E2DDD6", background: "#F5F3EE", cursor: "pointer", fontSize: 16 }}>←</button>
        <div>
          <div style={S.title}>สวัสดี, {name}</div>
          <div style={S.sub}>แผนก{dept.name}</div>
        </div>
        <span style={S.badge}>{dept.name}</span>
      </div>
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
        <div onClick={() => setScreen("cart")} style={{ margin: "10px 16px 14px", padding: "14px 16px", background: "#3B6B0F", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            🛒 ดูตะกร้า
            <span style={{ background: "#fff", color: "#3B6B0F", fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 10, marginLeft: 8 }}>{itemCount}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{total} บาท</span>
        </div>
      )}
    </div>
  );

  // ── CART ─────────────────────────────────────────────
  if (screen === "cart") return (
    <div style={S.app}>
      <div style={S.topbar}>
        <button onClick={() => setScreen("menu")} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #E2DDD6", background: "#F5F3EE", cursor: "pointer", fontSize: 16 }}>←</button>
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

  // ── STATUS ───────────────────────────────────────────
  const statusMeta = {
    new:     { icon: "📋", title: "ออร์เดอร์ถูกส่งแล้ว", sub: "รอร้านรับออร์เดอร์",     bg: "#EEF2FF" },
    cooking: { icon: "👨‍🍳", title: "กำลังปรุงอาหาร",     sub: "ประมาณ 10–15 นาที",      bg: "#FEF3DC" },
    done:    { icon: "✅", title: "อาหารพร้อมแล้ว!",    sub: "รับที่เคาน์เตอร์ได้เลย",  bg: "#EBF3DC" },
  };
  const sm = statusMeta[order?.status ?? "new"];

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div>
          <div style={S.title}>สถานะออร์เดอร์</div>
          <div style={S.sub}>#{String(order?.id).padStart(4, "0")} · {name}</div>
        </div>
        <span style={{ ...S.badge, background: sm.bg }}>
          {order?.status === "done" ? "เสร็จแล้ว" : order?.status === "cooking" ? "กำลังทำ" : "ใหม่"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px 16px", gap: 8, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: sm.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 4 }}>{sm.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{sm.title}</div>
        <div style={{ fontSize: 13, color: "#7A7570" }}>{sm.sub}</div>
      </div>
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
      <div style={{ padding: "0 16px 16px" }}>
        <p style={{ fontSize: 11, color: "#7A7570", textAlign: "center", marginBottom: 10 }}>ชำระเงินที่เคาน์เตอร์หลังรับอาหาร</p>
        <button
          onClick={() => { setScreen("menu"); setCart({}); setNote(""); setOrder(null); }}
          style={{ width: "100%", padding: 12, background: "#F5F3EE", color: "#3B6B0F", border: "1px solid #B5D47A", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}
        >
          สั่งอาหารเพิ่ม
        </button>
      </div>
    </div>
  );
}

// ── Outer: ห่อ Suspense (required by Next.js 14+ App Router) ──
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
