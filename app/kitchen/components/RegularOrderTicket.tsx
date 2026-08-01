// ─── app/kitchen/components/RegularOrderTicket.tsx ───────
import type { Order } from "@/types";
import { C, FD, FM, IconCheck, IconX, TicketShell, fmtElapsed, fmtTime, orderCode, stateTagStyle } from "../shared";

export function RegularOrderTicket({
  order, itemMarks, onSetItemMark, onAccept, onReject, onComplete, onFlag,
}: {
  order: Order;
  itemMarks: Record<string, "ok" | "no">;
  onSetItemMark: (orderId: number, idx: number, mark: "ok" | "no") => void;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onComplete: (id: number) => void;
  onFlag: (orderId: number, name: string) => void;
}) {
  const o = order;
  const hasAttn = o.status === "cooking" && o.items.some((_, i) => itemMarks[`${o.id}_${i}`] === "no");
  const tagKind = o.status === "new" ? "pending" : hasAttn ? "attn" : "cooking";
  const tagLabel = o.status === "new" ? "รอตอบรับ" : hasAttn ? "แจ้งลูกค้า" : "กำลังเตรียม";
  return (
    <TicketShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", borderBottom: `1px solid ${C.line}` }}>
        <div>
          <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 19, color: C.ink }}>{orderCode(o.id)}</div>
          <div style={{ fontFamily: FM, fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{fmtTime(o.created_at)} · {fmtElapsed(o.created_at, o.started_at)}</div>
        </div>
        <span style={stateTagStyle(tagKind)}>{tagLabel}</span>
      </div>
      <div style={{ padding: "12px 20px 4px" }}>
        <div style={{ fontSize: 15, color: C.inkSoft, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          👤 {o.customer_name}
          <button onClick={() => onFlag(o.id, o.customer_name)} title="รายงานชื่อไม่เหมาะสม" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: C.inkSoft, opacity: 0.6 }}>🚩</button>
        </div>
        {o.items.map((it, i) => {
          const key = `${o.id}_${i}`;
          const mark = itemMarks[key];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", fontSize: 18, borderBottom: i < o.items.length - 1 ? `1px dashed ${C.line}` : "none", color: C.ink }}>
              <span style={{ fontFamily: FM, color: C.inkSoft, fontSize: 15, minWidth: 26 }}>x{it.qty}</span>
              <span style={{ flex: 1 }}>{it.name}</span>
              {o.status === "cooking" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onSetItemMark(o.id, i, "ok")} style={{ width: 38, height: 38, border: `1.5px solid ${mark === "ok" ? C.sage : C.line}`, background: mark === "ok" ? C.sage : "transparent", color: mark === "ok" ? C.paper : C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}><IconCheck /></button>
                  <button onClick={() => onSetItemMark(o.id, i, "no")} style={{ width: 38, height: 38, border: `1.5px solid ${mark === "no" ? C.plum : C.line}`, background: mark === "no" ? C.plum : "transparent", color: mark === "no" ? C.paper : C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}><IconX /></button>
                </div>
              )}
            </div>
          );
        })}
        {o.note && <div style={{ fontSize: 14, color: C.ochre, fontStyle: "italic", margin: "8px 0" }}>📝 {o.note}</div>}
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
