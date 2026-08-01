// ─── app/kitchen/components/AddMenuForm.tsx ──────────────
import { C, FB, FD, IconPhoto } from "../shared";

export function AddMenuForm({
  allCats,
  newName, setNewName,
  newPrice, setNewPrice,
  newCat, setNewCat,
  newCatCustom, setNewCatCustom,
  newCatText, setNewCatText,
  newEmoji, setNewEmoji,
  newIng, setNewIng,
  newDailyLimit, setNewDailyLimit,
  newImagePreview, setNewImageFile, setNewImagePreview,
  adding, imgUploading,
  onCancel, onAdd,
}: {
  allCats: string[];
  newName: string; setNewName: (v: string) => void;
  newPrice: string; setNewPrice: (v: string) => void;
  newCat: string; setNewCat: (v: string) => void;
  newCatCustom: boolean; setNewCatCustom: (v: boolean) => void;
  newCatText: string; setNewCatText: (v: string) => void;
  newEmoji: string; setNewEmoji: (v: string) => void;
  newIng: string; setNewIng: (v: string) => void;
  newDailyLimit: string; setNewDailyLimit: (v: string) => void;
  newImagePreview: string | null;
  setNewImageFile: (f: File | null) => void;
  setNewImagePreview: (v: string | null) => void;
  adding: boolean;
  imgUploading: boolean;
  onCancel: () => void;
  onAdd: () => void;
}) {
  return (
    <div style={{ gridColumn: "1 / -1", background: C.paper2, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ width: 60, height: 60, borderRadius: 8, background: C.photoBg, border: `1px dashed ${C.inkSoft}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0, color: C.inkSoft }}>
          {newImagePreview ? <img src={newImagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconPhoto />}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setNewImageFile(f); setNewImagePreview(URL.createObjectURL(f)); }} />
        </label>
        <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🍽️" style={{ width: 54, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 6px", textAlign: "center", fontSize: 16, fontFamily: FB, color: C.ink }} />
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อเมนู" style={{ flex: 1, minWidth: 140, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FB, color: C.ink }} />
        <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="ราคา" style={{ width: 100, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FB, color: C.ink }} />
        {!newCatCustom ? (
          <select value={newCat} onChange={e => { if (e.target.value === "__custom__") { setNewCatCustom(true); setNewCatText(""); } else setNewCat(e.target.value); }}
            style={{ minWidth: 140, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FB, color: C.ink }}>
            {allCats.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">+ หมวดใหม่...</option>
          </select>
        ) : (
          <div style={{ display: "flex", gap: 6, minWidth: 140 }}>
            <input value={newCatText} onChange={e => setNewCatText(e.target.value)} placeholder="หมวดใหม่" autoFocus style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.ochre}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FB, color: C.ink }} />
            <button onClick={() => { setNewCatCustom(false); setNewCatText(""); }} style={{ padding: "0 10px", background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 8, color: C.inkSoft, cursor: "pointer" }}>✕</button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input value={newIng} onChange={e => setNewIng(e.target.value)} placeholder="วัตถุดิบ (ถ้ามี)" style={{ flex: 1, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FB, color: C.ink }} />
        <input type="number" min={1} value={newDailyLimit} onChange={e => setNewDailyLimit(e.target.value)} placeholder="จำกัด/วัน (ว่าง=ไม่จำกัด)" style={{ width: 170, background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FB, color: C.ink }} />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ background: "transparent", border: `1.5px solid ${C.line}`, color: C.inkSoft, borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontFamily: FD, fontSize: 15 }}>ยกเลิก</button>
        <button onClick={onAdd} disabled={adding} style={{ background: C.sage, color: C.paper, border: "none", borderRadius: 8, padding: "12px 20px", fontWeight: 700, cursor: "pointer", fontFamily: FD, fontSize: 15 }}>{adding ? (imgUploading ? "กำลังอัปโหลดรูป..." : "กำลังเพิ่ม...") : "บันทึก"}</button>
      </div>
    </div>
  );
}
