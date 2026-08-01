// ─── app/kitchen/components/CustomOrderTicket.tsx ────────
import type { CustomOrder } from "@/lib/supabase";
import { C, FD, FM, TicketShell, fmtElapsed, fmtTime, orderCode, stateTagStyle } from "../shared";

export function CustomOrderTicket({
  order, onAccept, onReject, onComplete, onFlag,
}: {
  order: CustomOrder;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onComplete: (id: number) => void;
  onFlag: (orderId: number, name: string) => void;
}) {
  const o = order;
  return (
    <TicketShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", borderBottom: `1px solid ${C.line}` }}>
        <div>
          <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 19, color: C.ink }}>{orderCode(o.id)} <span style={{ fontSize: 13, color: C.ochre, fontFamily: FD }}>✏️ ตามสั่ง</span></div>
          <div style={{ fontFamily: FM, fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{fmtTime(o.created_at)} · {fmtElapsed(o.created_at, o.started_at)}</div>
        </div>
        <span style={stateTagStyle(o.status === "new" ? "pending" : "cooking")}>{o.status === "new" ? "รอตอบรับ" : "กำลังเตรียม"}</span>
      </div>
      <div style={{ padding: "12px 20px 4px" }}>
        <div style={{ fontSize: 15, color: C.inkSoft, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          👤 {o.customer_name}
          <button onClick={() => onFlag(o.id, o.customer_name)} title="รายงานชื่อไม่เหมาะสม" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: C.inkSoft, opacity: 0.6 }}>🚩</button>
        </div>
        <div style={{ fontSize: 18, color: C.ink, padding: "8px 0", whiteSpace: "pre-wrap" }}>{o.items}</div>
        {o.note && <div style={{ fontSize: 14, color: C.ochre, fontStyle: "italic", marginBottom: 8 }}>📝 {o.note}</div>}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "16px 20px 20px" }}>
        {o.status === "new" ? (
          <>
            <button onClick={() => onAccept(o.id)} style={{ flex: 1, border: "none", borderRadius: 8, padding: "16px 0", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: FD, background: C.sage, color: C.paper }}>รับออเดอร์</button>
            <button onClick={() => onReject(o.id)} style={{ flex: 1, border: `1.5px solid ${C.plum}`, borderRadius: 8, padding: "16px 0", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: FD, background: "transparent", color: C.plum }}>ปฏิเสธ</button>
          </>
        ) : (
          <button onClick={() => onComplete(o.id)} style={{ flex: 1, border: "none", borderRadius: 8, padding: "16px 0", fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: FD, background: C.ochre, color: C.paper }}>ส่งอาหารแล้ว</button>
        )}
      </div>
    </TicketShell>
  );
}
