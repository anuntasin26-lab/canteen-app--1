"use client";
// ─── app/order/menu/page.tsx ──────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "../OrderContext";
import { S } from "../styles";

export default function MenuPage() {
  const router = useRouter();
  const {
    loading, name, order, CATS, cat, setCat, filtered, cart, add, sub,
    itemCount, total, showBanner, setShowBanner, announcement,
  } = useOrder();

  // ── redirect guard: ต้องมีชื่อก่อนถึงจะดูเมนูได้ ──────────
  useEffect(() => {
    if (!loading && !name) router.replace("/order/name");
  }, [loading, name, router]);

  // ── scroll affordance: บอกว่าแถบหมวดหมู่ยังเลื่อนได้อีก ────
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);
  useEffect(() => {
    const el = catScrollRef.current;
    if (!el) return;
    const check = () => setCanScrollMore(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => { el.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [CATS.length]);

  if (loading || !name) return null;

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <button
          onClick={() => router.push(order ? "/order/status" : "/order/name")}
          aria-label="ย้อนกลับ"
          style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid #E2DDD6", background: "#F5F3EE", cursor: "pointer", fontSize: 16, flexShrink: 0 }}
        >
          ←
        </button>
        <div style={S.title}>สวัสดี, {name}</div>
        <div style={{ width: 44 }} />
      </div>

      {showBanner && announcement && (
        <div style={{ margin: "10px 16px 0", padding: "10px 14px", background: "#FEF3DC", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#C97A14", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>📢 {announcement}</span>
          <button onClick={() => setShowBanner(false)} aria-label="ปิดประกาศ" style={{ background: "transparent", border: "none", color: "#C97A14", fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1, minWidth: 32, minHeight: 32 }}>×</button>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <div ref={catScrollRef} style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", borderBottom: "1px solid #E2DDD6" }}>
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: "8px 14px", minHeight: 36, borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: cat === c ? "none" : "1.5px solid #E2DDD6", background: cat === c ? "#3B6B0F" : "transparent", color: cat === c ? "#fff" : "#7A7570", fontFamily: "Sarabun, sans-serif" }}>
              {c}
            </button>
          ))}
        </div>
        {canScrollMore && (
          <div aria-hidden style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 28, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.95))", pointerEvents: "none" }} />
        )}
      </div>

      <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={S.emptyState}>
            <div style={{ fontSize: 36 }}>🍽️</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>ไม่มีเมนูในหมวดนี้ตอนนี้</div>
            <div style={{ fontSize: 12 }}>ลองเลือกหมวดหมู่อื่นดูนะ</div>
          </div>
        ) : filtered.map((m) => (
          <MenuRow key={m.id} m={m} qty={cart[m.id] ?? 0} onAdd={() => add(m.id)} onSub={() => sub(m.id)} />
        ))}
        {itemCount > 0 && <div style={{ height: 64 }} />}
      </div>

      {itemCount > 0 && (
        <div
          role="button" tabIndex={0}
          onClick={() => router.push("/order/cart")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push("/order/cart"); }}
          style={{ margin: "10px 16px 0", padding: "14px 16px", background: "#3B6B0F", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            🛒 ดูตะกร้า
            <span style={{ background: "#fff", color: "#3B6B0F", fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 10, marginLeft: 8 }}>{itemCount}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{total} บาท</span>
        </div>
      )}

      <div
        role="button" tabIndex={0}
        onClick={() => router.push("/order/custom")}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push("/order/custom"); }}
        style={{ margin: itemCount > 0 ? "8px 16px 14px" : "10px 16px 14px", padding: "13px 16px", background: "#FEF3DC", border: "1.5px solid #F2CD8F", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#A8650E" }}>✏️ สั่งอาหารตามสั่ง</span>
        <span style={{ fontSize: 13, color: "#A8650E" }}>พิมพ์เองได้ →</span>
      </div>
    </div>
  );
}

function MenuRow({ m, qty, onAdd, onSub }: { m: any; qty: number; onAdd: () => void; onSub: () => void }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid #E2DDD6", borderRadius: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: "#F5F3EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, overflow: "hidden" }}>
        {m.image_url && !imgError ? (
          <img src={m.image_url} alt="" onError={() => setImgError(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : m.emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1A17" }}>
          {m.name}
          {m.remaining_today !== null && m.remaining_today !== undefined && m.remaining_today <= 5 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#B4740E", background: "#FBF0DC", padding: "2px 7px", borderRadius: 6, marginLeft: 6 }}>
              เหลือ {m.remaining_today} ที่
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#3B6B0F" }}>{m.price} บาท</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {qty > 0 ? (
          <>
            <button onClick={onSub} aria-label={`ลด ${m.name}`} style={S.qtyBtn}>−</button>
            <span style={{ fontSize: 14, fontWeight: 700, minWidth: 22, textAlign: "center" }}>{qty}</span>
            <button onClick={onAdd} aria-label={`เพิ่ม ${m.name}`} style={S.qtyBtnFilled}>+</button>
          </>
        ) : (
          <button onClick={onAdd} aria-label={`เพิ่ม ${m.name}`} style={S.qtyBtnFilled}>+</button>
        )}
      </div>
    </div>
  );
}
