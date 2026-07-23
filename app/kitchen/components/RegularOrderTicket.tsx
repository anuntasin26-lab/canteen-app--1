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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 10px", borderBottom: `1px dashed ${C.line}` }}>
        <div>
          <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: C.ink }}>{orderCode(o.id)}</div>
          <div style={{ fontFamily: FM, fontSize: 11, color: C.inkSoft }}>{fmtTime(o.created_at)} · {fmtElapsed(o.created_at, o.started_at)}</div>
        </div>
        <span style={stateTagStyle(tagKind)}>{tagLabel}</span>
      </div>
      <div style={{ padding: "10px 18px 4px" }}>
        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
          👤 {o.customer_name}
          <button onClick={() => onFlag(o.id, o.customer_name)} title="รายงานชื่อไม่เหมาะสม" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: C.inkSoft, opacity: 0.6 }}>🚩</button>
        </div>
        {o.items.map((it, i) => {
          const key = `${o.id}_${i}`;
          const mark = itemMarks[key];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 14.5, borderBottom: i < o.items.length - 1 ? `1px dotted ${C.line}` : "none", color: C.ink }}>
              <span style={{ fontFamily: FM, color: C.inkSoft, fontSize: 12, minWidth: 20 }}>x{it.qty}</span>
              <span style={{ flex: 1 }}>{it.name}</span>
              {o.status === "cooking" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onSetItemMark(o.id, i, "ok")} style={{ width: 25, height: 25, border: `1.5px solid ${mark === "ok" ? C.sage : C.ink}`, background: mark === "ok" ? C.sage : C.paper, color: mark === "ok" ? C.paper : C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3 }}><IconCheck /></button>
                  <button onClick={() => onSetItemMark(o.id, i, "no")} style={{ width: 25, height: 25, border: `1.5px solid ${mark === "no" ? C.plum : C.ink}`, background: mark === "no" ? C.plum : C.paper, color: mark === "no" ? C.paper : C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3 }}><IconX /></button>
                </div>
              )}
            </div>
          );
        })}
        {o.note && <div style={{ fontSize: 12.5, color: C.ochre, fontStyle: "italic", margin: "6px 0" }}>📝 {o.note}</div>}
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
