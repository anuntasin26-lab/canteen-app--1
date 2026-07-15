"use client";
// ─── app/order/name/page.tsx ──────────────────────────────

import { useRouter } from "next/navigation";
import { useOrder } from "../OrderContext";
import { S } from "../styles";

export default function NamePage() {
  const router = useRouter();
  const { name, setName, handleGoMenu } = useOrder();

  const goMenu = () => {
    if (!name.trim()) return;
    handleGoMenu();
    router.push("/order/menu");
  };

  return (
    <div style={S.app}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 24px", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1A17", marginBottom: 8 }}>สั่งอาหารได้เลย</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7A7570", letterSpacing: ".04em", textTransform: "uppercase" as const }}>
            ชื่อของคุณ
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goMenu()}
            placeholder="เช่น สมชาย, วิไล..."
            autoFocus
            style={S.input}
          />
          <button
            disabled={!name.trim()}
            onClick={goMenu}
            style={{ padding: 14, minHeight: 48, background: name.trim() ? "#3B6B0F" : "#E2DDD6", color: name.trim() ? "#fff" : "#7A7570", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "Sarabun, sans-serif" }}
          >
            ดูเมนู →
          </button>
        </div>
      </div>
    </div>
  );
}
