// ─── app/kitchen/components/KitchenTabs.tsx ──────────────
import { C, FD, FM } from "../shared";

export type KitchenTab = "order" | "menu" | "history";

export function KitchenTabs({
  tab, setTab, pendingCount,
}: {
  tab: KitchenTab;
  setTab: (t: KitchenTab) => void;
  pendingCount: number;
}) {
  const items: [KitchenTab, string, number][] = [
    ["order",   "ออเดอร์", pendingCount],
    ["menu",    "เมนู",   0],
    ["history", "ประวัติ", 0],
  ];
  return (
    <nav style={{ display: "flex", gap: 4, padding: "24px 26px 0" }}>
      {items.map(([t, label, count]) => (
        <button key={t} onClick={() => setTab(t)}
          style={{
            background: tab === t ? C.paper : C.paper2, border: `2px solid ${C.ink}`, borderBottom: tab === t ? `2px solid ${C.paper}` : `2px solid ${C.ink}`,
            padding: tab === t ? "10px 24px 14px" : "10px 24px 12px", borderRadius: "8px 8px 0 0", cursor: "pointer",
            fontFamily: FD, fontWeight: 600, fontSize: 15, color: tab === t ? C.ink : C.inkSoft,
            position: "relative", top: tab === t ? 0 : 2, marginBottom: -2,
          }}>
          {label}
          {count > 0 && <span style={{ background: C.plum, color: C.paper, fontFamily: FM, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, marginLeft: 6 }}>{count}</span>}
        </button>
      ))}
    </nav>
  );
}
