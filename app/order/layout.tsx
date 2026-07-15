"use client";
// ─── app/order/layout.tsx ─────────────────────────────────
// ครอบทุกหน้าใน /order/* ด้วย OrderProvider (state ใช้ร่วมกัน)
// + global focus-visible style (คืนสิ่งที่ outline:none ลบไปเดิม)
// + modal กลางจอแทน alert() ทุกจุด

import { OrderProvider, useOrder } from "./OrderContext";

function ErrorModal() {
  const { modal, closeModal } = useOrder();
  if (!modal) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      onClick={closeModal}
      style={{
        position: "fixed", inset: 0, background: "rgba(28,26,23,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, padding: "24px 20px", maxWidth: 340, width: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          textAlign: "center", boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#FDECEA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
          ⚠️
        </div>
        <div style={{ fontSize: 14, color: "#1C1A17", lineHeight: 1.6 }}>{modal.message}</div>
        <button
          autoFocus
          onClick={closeModal}
          style={{
            width: "100%", padding: 12, background: "#3B6B0F", color: "#fff", border: "none",
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sarabun, sans-serif",
          }}
        >
          ตกลง
        </button>
      </div>
    </div>
  );
}

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrderProvider>
      <style>{`
        /* คืน focus indicator ที่ inline outline:none เดิมเคยลบทิ้งไปหมด —
           ใช้ :focus-visible เพื่อไม่ให้ขึ้นเวลาคลิกด้วยเมาส์ (เฉพาะ keyboard) */
        #order-root input:focus-visible,
        #order-root textarea:focus-visible,
        #order-root button:focus-visible {
          outline: 2px solid #3B6B0F;
          outline-offset: 2px;
        }
      `}</style>
      <div id="order-root">
        {children}
        <ErrorModal />
      </div>
    </OrderProvider>
  );
}
