// ─── app/kitchen/components/KitchenHeader.tsx ────────────
import { C, FD, FM, IconLock } from "../shared";

export function KitchenHeader({
  dateLabel, clockLabel, onLock,
}: {
  dateLabel: string;
  clockLabel: string;
  onLock: () => void;
}) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 26px 16px", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", border: `2px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontWeight: 700, fontSize: 16, color: C.ink }}>PP</div>
        <div>
          <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 24, color: C.ink }}>ครัว PETPAL</div>
          <div style={{ fontSize: 13, color: C.inkSoft, fontFamily: FM, marginTop: 2 }}>รายการเตรียมอาหาร · {dateLabel}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: FM, fontSize: 13, color: C.inkSoft, textAlign: "right" }}>
          <b style={{ color: C.ink, display: "block", fontSize: 16 }}>{clockLabel}</b>
          เวลาปัจจุบัน
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.sage, fontSize: 13, fontWeight: 600, fontFamily: FD }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.sage }} />เปิดรับออเดอร์
        </div>
        <button onClick={onLock} style={{ width: 44, height: 44, borderRadius: "50%", border: `1.5px solid ${C.line}`, background: "transparent", color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><IconLock /></button>
      </div>
    </header>
  );
}
