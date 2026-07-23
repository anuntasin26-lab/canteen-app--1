// ─── app/kitchen/components/OrdersPanel.tsx ──────────────
import type { Order } from "@/types";
import type { CustomOrder } from "@/lib/supabase";
import { C } from "../shared";
import { RegularOrderTicket } from "./RegularOrderTicket";
import { CustomOrderTicket } from "./CustomOrderTicket";

export type Ticket =
  | { kind: "reg"; sortTime: number; o: Order }
  | { kind: "custom"; sortTime: number; o: CustomOrder };

export function OrdersPanel({
  tickets, itemMarks, onSetItemMark,
  onAcceptOrder, onRejectOrder, onCompleteOrder,
  onAcceptCustom, onRejectCustom, onCompleteCustom,
  onFlag,
}: {
  tickets: Ticket[];
  itemMarks: Record<string, "ok" | "no">;
  onSetItemMark: (orderId: number, idx: number, mark: "ok" | "no") => void;
  onAcceptOrder: (id: number) => void;
  onRejectOrder: (id: number) => void;
  onCompleteOrder: (id: number) => void;
  onAcceptCustom: (id: number) => void;
  onRejectCustom: (id: number) => void;
  onCompleteCustom: (id: number) => void;
  onFlag: (orderId: number, name: string) => void;
}) {
  if (tickets.length === 0) {
    return <div style={{ color: C.inkSoft, padding: 14, fontStyle: "italic" }}>ยังไม่มีออเดอร์เข้ามาตอนนี้</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 18 }}>
      {tickets.map(t => t.kind === "custom" ? (
        <CustomOrderTicket
          key={`c${t.o.id}`}
          order={t.o}
          onAccept={onAcceptCustom}
          onReject={onRejectCustom}
          onComplete={onCompleteCustom}
          onFlag={onFlag}
        />
      ) : (
        <RegularOrderTicket
          key={`o${t.o.id}`}
          order={t.o}
          itemMarks={itemMarks}
          onSetItemMark={onSetItemMark}
          onAccept={onAcceptOrder}
          onReject={onRejectOrder}
          onComplete={onCompleteOrder}
          onFlag={onFlag}
        />
      ))}
    </div>
  );
}
