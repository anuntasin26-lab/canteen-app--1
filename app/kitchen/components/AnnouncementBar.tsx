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
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.sageBg, borderRadius: 4, padding: "12px 18px" }}>
          <span style={{ fontSize: 14 }}>📌</span>
          <span style={{ fontSize: 14, fontWeight: 500, flex: 1, fontStyle: "italic", color: C.ink }}>{announceText}</span>
          <button onClick={onStartEdit} style={{ background: "none", border: "none", color: C.sage, fontSize: 12, cursor: "pointer", textDecoration: "underline", fontWeight: 600, fontFamily: FB }}>เขียนประกาศเอง</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <textarea value={announceDraft} onChange={e => setAnnounceDraft(e.target.value)}
            style={{ flex: 1, border: `1.5px solid ${C.line}`, borderRadius: 4, padding: "10px 14px", fontFamily: FB, fontSize: 14, resize: "vertical", minHeight: 44, background: C.paper, color: C.ink }} />
          <button onClick={onSave} disabled={annSending} style={{ background: C.ink, color: C.paper, border: "none", borderRadius: 4, padding: "0 18px", fontWeight: 700, cursor: "pointer", fontFamily: FD }}>{annSending ? "..." : "บันทึก"}</button>
        </div>
      )}
    </div>
  );
}
