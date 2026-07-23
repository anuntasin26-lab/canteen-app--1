// ─── app/kitchen/components/AnnouncementBar.tsx ──────────
import { C, FB, FD } from "../shared";

export function AnnouncementBar({
  announceText, announceEditing, announceDraft, setAnnounceDraft,
  annSending, onStartEdit, onSave,
}: {
  announceText: string;
  announceEditing: boolean;
  announceDraft: string;
  setAnnounceDraft: (v: string) => void;
  annSending: boolean;
  onStartEdit: () => void;
  onSave: () => void;
}) {
  return (
    <div style={{ padding: "18px 26px 0" }}>
      {!announceEditing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.sageBg, borderRadius: 10, padding: "14px 18px" }}>
          <span style={{ fontSize: 15 }}>📌</span>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1, fontStyle: "italic", color: C.ink }}>{announceText}</span>
          <button onClick={onStartEdit} style={{ background: "none", border: "none", color: C.sage, fontSize: 13, cursor: "pointer", textDecoration: "underline", fontWeight: 600, fontFamily: FB }}>เขียนประกาศเอง</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <textarea value={announceDraft} onChange={e => setAnnounceDraft(e.target.value)}
            style={{ flex: 1, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "12px 14px", fontFamily: FB, fontSize: 15, resize: "vertical", minHeight: 48, background: C.paper2, color: C.ink }} />
          <button onClick={onSave} disabled={annSending} style={{ background: C.ochre, color: C.paper, border: "none", borderRadius: 8, padding: "0 20px", fontWeight: 700, cursor: "pointer", fontFamily: FD, fontSize: 15 }}>{annSending ? "..." : "บันทึก"}</button>
        </div>
      )}
    </div>
  );
}
