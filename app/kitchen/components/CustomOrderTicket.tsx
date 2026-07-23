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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 10px", borderBottom: `1px dashed ${C.line}` }}>
        <div>
          <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: C.ink }}>{orderCode(o.id)} <span style={{ fontSize: 10, color: C.ochre, fontFamily: FD }}>✏️ ตามสั่ง</span></div>
          <div style={{ fontFamily: FM, fontSize: 11, color: C.inkSoft }}>{fmtTime(o.created_at)} · {fmtElapsed(o.created_at, o.started_at)}</div>
        </div>
        <span style={stateTagStyle(o.status === "new" ? "pending" : "cooking")}>{o.status === "new" ? "รอตอบรับ" : "กำลังเตรียม"}</span>
      </div>
      <div style={{ padding: "10px 18px 4px" }}>
        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          👤 {o.customer_name}
          <button onClick={() => onFlag(o.id, o.customer_name)} title="รายงานชื่อไม่เหมาะสม" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: C.inkSoft, opacity: 0.6 }}>🚩</button>
        </div>
        <div style={{ fontSize: 14, color: C.ink, padding: "6px 0", whiteSpace: "pre-wrap" }}>{o.items}</div>
        {o.note && <div style={{ fontSize: 12.5, color: C.ochre, fontStyle: "italic", marginBottom: 6 }}>📝 {o.note}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "14px 18px 18px" }}>
        {o.status === "new" ? (
          <>
            <button onClick={() => onAccept(o.id)} style={{ flex: 1, border: `1.5px solid ${C.sage}`, borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: C.sage, color: C.paper }}>รับออเดอร์</button>
            <button onClick={() => onReject(o.id)} style={{ flex: 1, border: `1.5px solid ${C.plum}`, borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: "transparent", color: C.plum }}>ปฏิเสธ</button>
          </>
        ) : (
          <button onClick={() => onComplete(o.id)} style={{ flex: 1, border: "none", borderRadius: 3, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FD, background: C.ink, color: C.paper }}>ส่งอาหารแล้ว</button>
        )}
      </div>
    </TicketShell>
  );
}
