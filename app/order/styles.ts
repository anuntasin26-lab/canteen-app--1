// ─── app/order/styles.ts ──────────────────────────────────
// style constants ที่ใช้ร่วมกันทุกหน้าใน /order/* — รวมจุดแก้ไข UX/UI
// จาก audit: touch target ≥44px, safe-area-inset, ไม่มี outline:none
// (focus-visible ให้ CSS ใน layout.tsx จัดการแทน)

export const S = {
  app: {
    maxWidth: 420, margin: "0 auto", minHeight: "100dvh",
    background: "#fff", fontFamily: "Sarabun, sans-serif",
    display: "flex", flexDirection: "column" as const,
  },
  topbar: {
    padding: "calc(env(safe-area-inset-top) + 14px) 18px 10px", borderBottom: "1px solid #E2DDD6",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky" as const, top: 0, background: "#fff", zIndex: 10, gap: 10,
  },
  title: { fontSize: 16, fontWeight: 700, color: "#1C1A17" },
  sub:   { fontSize: 11, color: "#7A7570", marginTop: 1 },
  badge: {
    background: "#EBF3DC", color: "#3B6B0F", fontSize: 11, fontWeight: 600,
    padding: "3px 10px", borderRadius: 20, border: "1px solid #B5D47A",
  },
  // ปุ่มกลม +/− — เดิม 28px/26px ต่ำกว่ามาตรฐาน touch target 44px
  qtyBtn: {
    width: 44, height: 44, borderRadius: "50%", border: "1.5px solid #E2DDD6",
    background: "transparent", cursor: "pointer", fontSize: 18,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  qtyBtnFilled: {
    width: 44, height: 44, borderRadius: "50%", border: "none",
    background: "#3B6B0F", color: "#fff", cursor: "pointer", fontSize: 20,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bottomBar: {
    padding: "0 16px calc(env(safe-area-inset-bottom) + 16px)",
  },
  input: {
    padding: "14px 16px", border: "1.5px solid #E2DDD6", borderRadius: 12,
    fontSize: 16, fontFamily: "Sarabun, sans-serif", background: "#F5F3EE",
  },
  emptyState: {
    display: "flex", flexDirection: "column" as const, alignItems: "center",
    justifyContent: "center", padding: "48px 24px", gap: 8, textAlign: "center" as const,
    color: "#7A7570",
  },
};
