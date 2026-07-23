// ─── app/kitchen/components/MenuPanel.tsx ────────────────
import type { MenuItem } from "@/types";
import { C, FD } from "../shared";
import { AddMenuForm } from "./AddMenuForm";
import { MenuItemCard } from "./MenuItemCard";

export function MenuPanel({
  CATS, menuCat, setMenuCat,
  showAdd, setShowAdd,
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
  adding, imgUploading, onAddMenu,
  loadingMenu, filtered,
  editing, saving,
  editName, setEditName,
  editPrice, setEditPrice,
  editIng, setEditIng,
  editDailyLimit, setEditDailyLimit,
  editImagePreview, setEditImageFile, setEditImagePreview,
  deleteConfirm, setDeleteConfirm,
  onToggle, onOpenEdit, onCancelEdit, onSave, onDeleteMenu,
}: {
  CATS: string[];
  menuCat: string;
  setMenuCat: (c: string) => void;
  showAdd: boolean;
  setShowAdd: (v: boolean | ((v: boolean) => boolean)) => void;
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
  onAddMenu: () => void;
  loadingMenu: boolean;
  filtered: MenuItem[];
  editing: number | null;
  saving: number | null;
  editName: string; setEditName: (v: string) => void;
  editPrice: string; setEditPrice: (v: string) => void;
  editIng: string; setEditIng: (v: string) => void;
  editDailyLimit: string; setEditDailyLimit: (v: string) => void;
  editImagePreview: string | null;
  setEditImageFile: (f: File | null) => void;
  setEditImagePreview: (v: string | null) => void;
  deleteConfirm: number | null;
  setDeleteConfirm: (id: number | null) => void;
  onToggle: (item: MenuItem) => void;
  onOpenEdit: (item: MenuItem) => void;
  onCancelEdit: () => void;
  onSave: (item: MenuItem) => void;
  onDeleteMenu: (item: MenuItem) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setMenuCat(c)}
              style={{ padding: "10px 18px", borderRadius: 20, border: `1.5px solid ${menuCat === c ? C.ink : C.line}`, background: menuCat === c ? C.ink : "transparent", fontSize: 14, color: menuCat === c ? C.paper : C.ink, cursor: "pointer", fontWeight: 500, fontFamily: FD }}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(v => !v)} style={{ background: C.ochre, color: C.paper, border: "none", borderRadius: 8, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FD }}>+ เพิ่มเมนู</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 16 }}>
        <div onClick={() => setShowAdd(v => !v)} style={{ border: `1.5px dashed ${C.line}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 175, cursor: "pointer", color: C.inkSoft, flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 14, fontFamily: FD }}>
          <span style={{ fontSize: 22 }}>+</span><div>เพิ่มเมนูใหม่</div>
        </div>

        {showAdd && (
          <AddMenuForm
            allCats={allCats}
            newName={newName} setNewName={setNewName}
            newPrice={newPrice} setNewPrice={setNewPrice}
            newCat={newCat} setNewCat={setNewCat}
            newCatCustom={newCatCustom} setNewCatCustom={setNewCatCustom}
            newCatText={newCatText} setNewCatText={setNewCatText}
            newEmoji={newEmoji} setNewEmoji={setNewEmoji}
            newIng={newIng} setNewIng={setNewIng}
            newDailyLimit={newDailyLimit} setNewDailyLimit={setNewDailyLimit}
            newImagePreview={newImagePreview} setNewImageFile={setNewImageFile} setNewImagePreview={setNewImagePreview}
            adding={adding} imgUploading={imgUploading}
            onCancel={() => setShowAdd(false)}
            onAdd={onAddMenu}
          />
        )}

        {loadingMenu ? (
          <div style={{ color: C.inkSoft, padding: 20 }}>กำลังโหลด...</div>
        ) : filtered.map(item => (
          <MenuItemCard
            key={item.id}
            item={item}
            isEditing={editing === item.id}
            saving={saving === item.id}
            imgUploading={imgUploading}
            deleteConfirm={deleteConfirm === item.id}
            editName={editName} setEditName={setEditName}
            editPrice={editPrice} setEditPrice={setEditPrice}
            editIng={editIng} setEditIng={setEditIng}
            editDailyLimit={editDailyLimit} setEditDailyLimit={setEditDailyLimit}
            editImagePreview={editImagePreview} setEditImageFile={setEditImageFile} setEditImagePreview={setEditImagePreview}
            onToggle={() => onToggle(item)}
            onOpenEdit={() => onOpenEdit(item)}
            onCancelEdit={onCancelEdit}
            onSave={() => onSave(item)}
            onDeleteConfirm={() => setDeleteConfirm(item.id)}
            onDelete={() => onDeleteMenu(item)}
            onCancelDelete={() => setDeleteConfirm(null)}
          />
        ))}
      </div>
    </div>
  );
}
