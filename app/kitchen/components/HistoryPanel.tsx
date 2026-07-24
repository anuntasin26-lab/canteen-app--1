// ─── app/kitchen/components/HistoryPanel.tsx ─────────────
import type { Order } from "@/types";
import { C, FD, FM, fmtDate, orderCode } from "../shared";

export function HistoryPanel({
  history, hdays, setHdays,
}: {
  history: Order[];
  hdays: number;
  setHdays: (d: number) => void;
}) {
  const isDoneOf = (o: Order) => o.status === "done";
  const isCancelOf = (o: Order) => o.status === ("cancelled" as any);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[1, 7, 30].map(d => (
          <button key={d} onClick={() => setHdays(d)}
            style={{ padding: "10px 18px", borderRadius: 20, border: `1.5px solid ${hdays === d ? C.ink : C.line}`, background: hdays === d ? C.ink : "transparent", color: hdays === d ? C.paper : C.ink, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: FD }}>
            {d === 1 ? "วันนี้" : `${d} วัน`}
          </button>
        ))}
      </div>
      {history.length === 0 ? (
        <div style={{ color: C.inkSoft, padding: 10 }}>ยังไม่มีประวัติ</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {history.map(o => (
            <div key={o.id} style={{ display: "grid", gridTemplateColumns: "90px 90px 1fr 100px", gap: 14, alignItems: "center", padding: "14px 6px", borderBottom: `1px solid ${C.line}`, fontSize: 14.5 }}>
              <span style={{ fontFamily: FM, color: C.inkSoft }}>{fmtDate(o.created_at)}</span>
              <span style={{ fontFamily: FM, fontWeight: 600, color: C.ink }}>{orderCode(o.id)}</span>
              <span style={{ color: C.inkSoft, fontSize: 13.5, fontStyle: "italic", textDecoration: isCancelOf(o) ? "line-through" : "none" }}>{o.items.map(it => `${it.name} x${it.qty}`).join(", ")}</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, textAlign: "center", fontFamily: FD, background: isDoneOf(o) ? C.sageBg : C.plumBg, color: isDoneOf(o) ? C.sage : C.plum }}>
                {isDoneOf(o) ? "เสร็จสิ้น" : "ยกเลิก"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
