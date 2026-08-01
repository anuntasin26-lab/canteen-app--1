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
    <nav style={{ display: "flex", gap: 6, padding: "20px 26px 0" }}>
      {items.map(([t, label, count]) => (
        <button key={t} onClick={() => setTab(t)}
          style={{
            flex: 1, background: tab === t ? C.ink : C.paper2, border: `1px solid ${tab === t ? C.ink : C.line}`,
            padding: "14px 0", borderRadius: 10, cursor: "pointer",
            fontFamily: FD, fontWeight: 600, fontSize: 16, color: tab === t ? C.paper : C.inkSoft,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
          {label}
          {count > 0 && <span style={{ background: C.plum, color: C.paper, fontFamily: FM, fontSize: 12, fontWeight: 700, padding: "1px 8px", borderRadius: 999 }}>{count}</span>}
        </button>
      ))}
    </nav>
  );
}
