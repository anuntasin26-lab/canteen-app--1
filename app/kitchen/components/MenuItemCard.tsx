// ─── app/kitchen/components/MenuItemCard.tsx ─────────────
import type { MenuItem } from "@/types";
import { C, FB, FD, FM, IconPhoto } from "../shared";

export function MenuItemCard({
  item, isEditing, saving, imgUploading, deleteConfirm,
  editName, setEditName,
  editPrice, setEditPrice,
  editIng, setEditIng,
  editDailyLimit, setEditDailyLimit,
  editImagePreview, setEditImageFile, setEditImagePreview,
  onToggle, onOpenEdit, onCancelEdit, onSave,
  onDeleteConfirm, onDelete, onCancelDelete,
}: {
  item: MenuItem;
  isEditing: boolean;
  saving: boolean;
  imgUploading: boolean;
  deleteConfirm: boolean;
  editName: string; setEditName: (v: string) => void;
  editPrice: string; setEditPrice: (v: string) => void;
  editIng: string; setEditIng: (v: string) => void;
  editDailyLimit: string; setEditDailyLimit: (v: string) => void;
  editImagePreview: string | null;
  setEditImageFile: (f: File | null) => void;
  setEditImagePreview: (v: string | null) => void;
  onToggle: () => void;
  onOpenEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDeleteConfirm: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div style={{ gridColumn: isEditing ? "1 / -1" : undefined }}>
      <div style={{ background: C.paper2, border: `1px solid ${C.line}`, borderRadius: 3, overflow: "hidden", display: "flex", flexDirection: "column", opacity: item.available ? 1 : 0.45 }}>
        <div style={{ height: 115, background: C.photoBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, overflow: "hidden" }}>
          {(item as any).image_url ? <img src={(item as any).image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconPhoto />}
        </div>
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 15, fontFamily: FD, color: C.ink }}>{item.name}</div>
            <div style={{ fontFamily: FM, fontWeight: 700, color: C.ochre, fontSize: 14 }}>{item.price}฿</div>
          </div>
          <div style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>{(item as any).ingredients || "—"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderTop: `1px dashed ${C.line}` }}>
          <label style={{ position: "relative", width: 36, height: 19, cursor: saving ? "not-allowed" : "pointer" }}>
            <input type="checkbox" checked={item.available} disabled={saving} onChange={onToggle} style={{ display: "none" }} />
            <div style={{ position: "absolute", inset: 0, background: item.available ? C.sageBg : C.line, border: `1px solid ${item.available ? C.sage : C.inkSoft}`, borderRadius: 999 }} />
            <div style={{ position: "absolute", top: 2, left: item.available ? 19 : 2, width: 15, height: 15, borderRadius: "50%", background: item.available ? C.sage : "#fff", border: `1px solid ${item.available ? C.sage : C.inkSoft}`, transition: "left .15s" }} />
          </label>
          <button onClick={onOpenEdit} style={{ width: 25, height: 25, border: `1.5px solid ${C.ink}`, background: C.paper, color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, fontSize: 12 }}>✎</button>
        </div>
      </div>

      {isEditing && (
        <div style={{ background: C.paper2, border: `1.5px solid ${C.ink}`, borderRadius: 4, padding: 16, marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ width: 60, height: 60, borderRadius: 4, background: C.photoBg, border: `1px dashed ${C.inkSoft}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0, color: C.inkSoft }}>
              {editImagePreview ? <img src={editImagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconPhoto />}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setEditImageFile(f); setEditImagePreview(URL.createObjectURL(f)); }} />
            </label>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="ชื่อเมนู" style={{ flex: 1, minWidth: 140, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
            <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="ราคา" style={{ width: 100, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input value={editIng} onChange={e => setEditIng(e.target.value)} placeholder="วัตถุดิบ" style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
            <input type="number" min={1} value={editDailyLimit} onChange={e => setEditDailyLimit(e.target.value)} placeholder="จำกัด/วัน (ว่าง=ไม่จำกัด)" style={{ width: 170, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 3, padding: "9px 12px", fontSize: 14, fontFamily: FB, color: C.ink }} />
          </div>
          {item.remaining_today !== null && item.remaining_today !== undefined && (
            <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: FB }}>
              วันนี้เหลือ {item.remaining_today} / {item.daily_limit} ที่
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onDeleteConfirm} style={{ background: "transparent", border: `1.5px solid ${C.plum}`, color: C.plum, borderRadius: 3, padding: "9px 14px", cursor: "pointer", fontFamily: FD }}>ลบ</button>
            <button onClick={onCancelEdit} style={{ background: "transparent", border: `1.5px solid ${C.inkSoft}`, color: C.inkSoft, borderRadius: 3, padding: "9px 18px", cursor: "pointer", fontFamily: FD }}>ยกเลิก</button>
            <button onClick={onSave} disabled={saving} style={{ background: C.sage, color: C.paper, border: "none", borderRadius: 3, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontFamily: FD }}>{saving ? (imgUploading ? "กำลังอัปโหลดรูป..." : "กำลังบันทึก...") : "บันทึก"}</button>
          </div>
          {deleteConfirm && (
            <div style={{ padding: 12, background: C.plumBg, borderRadius: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.plum, marginBottom: 8, fontFamily: FB }}>⚠️ ลบ &quot;{item.name}&quot; ถาวร?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onDelete} style={{ flex: 1, padding: 8, background: C.plum, color: C.paper, border: "none", borderRadius: 3, fontWeight: 700, cursor: "pointer", fontFamily: FD }}>ยืนยันลบ</button>
                <button onClick={onCancelDelete} style={{ flex: 1, padding: 8, background: C.paper, color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 3, cursor: "pointer", fontFamily: FD }}>ไม่ลบ</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
