"use client";
// ─── app/admin/page.tsx ───────────────────────────────────
// Admin — login เดียวกับครัว (Supabase Auth) แต่แยก route/แยก login คนละครั้ง
// เนื้อหา Dashboard + Settings จะเพิ่มใน Phase 3 (กันขายเกิน) และ Phase 4 (บล็อกคำหยาบ)

import { useEffect, useState } from "react";
import {
  signInStaff, signOutStaff,
  getBlacklistWords, addBlacklistWord, removeBlacklistWord,
  getFlaggedNames, resolveFlaggedName,
  getAuditLog,
} from "@/lib/supabase";

const C = {
  green: "#3B6B0F", greenL: "#EBF3DC",
  red: "#C0392B", redL: "#FDECEA",
  text: "#1C1A17", muted: "#7A7570", border: "#E2DDD6", bg: "#F5F3EE",
};

export default function AdminPage() {
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [unlocked,   setUnlocked]   = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [loggingIn,  setLoggingIn]  = useState(false);
  const [tab, setTab] = useState<"dashboard" | "settings">("dashboard");
  const [blacklist, setBlacklist] = useState<{ id: number; word: string; created_at: string }[]>([]);
  const [flagged, setFlagged] = useState<{ id: number; order_id: number | null; flagged_text: string; created_at: string }[]>([]);
  const [newWord, setNewWord] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [auditLog, setAuditLog] = useState<{ id: number; actor_id: string | null; action: string; target_type: string; target_id: number | null; detail: any; created_at: string }[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (!unlocked || tab !== "dashboard") return;
    setLoadingAudit(true);
    getAuditLog(50).then(setAuditLog).finally(() => setLoadingAudit(false));
  }, [unlocked, tab]);

  useEffect(() => {
    if (!unlocked || tab !== "settings") return;
    setLoadingSettings(true);
    Promise.all([getBlacklistWords(), getFlaggedNames()])
      .then(([b, f]) => { setBlacklist(b); setFlagged(f); })
      .finally(() => setLoadingSettings(false));
  }, [unlocked, tab]);

  const handleAddWord = async () => {
    if (!newWord.trim()) return;
    try {
      const created = await addBlacklistWord(newWord.trim());
      setBlacklist((prev) => [created, ...prev]);
      setNewWord("");
    } catch (e: any) {
      alert("เพิ่มไม่สำเร็จ: " + (e?.message ?? ""));
    }
  };

  const handleRemoveWord = async (id: number) => {
    try {
      await removeBlacklistWord(id);
      setBlacklist((prev) => prev.filter((w) => w.id !== id));
    } catch (e: any) {
      alert("ลบไม่สำเร็จ: " + (e?.message ?? ""));
    }
  };

  const handleResolveFlag = async (id: number, addToBlacklist: boolean, word?: string) => {
    try {
      await resolveFlaggedName(id, addToBlacklist, word);
      setFlagged((prev) => prev.filter((f) => f.id !== id));
      if (addToBlacklist) getBlacklistWords().then(setBlacklist);
    } catch (e: any) {
      alert("ดำเนินการไม่สำเร็จ: " + (e?.message ?? ""));
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoggingIn(true);
    setLoginError(false);
    try {
      await signInStaff(email.trim(), password);
      setUnlocked(true);
    } catch {
      setLoginError(true);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOutStaff();
    setUnlocked(false);
    setEmail(""); setPassword("");
  };

  if (!unlocked) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "Sarabun, sans-serif", padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⚙️</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Admin — PETPAL</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>เข้าสู่ระบบเพื่อใช้งาน</div>
      <form
        onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
        style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 280, width: "100%" }}
      >
        <input
          type="email" autoComplete="username" placeholder="อีเมล" value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: "13px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 16, fontFamily: "Sarabun, sans-serif", background: "#fff", color: C.text }}
        />
        <input
          type="password" autoComplete="current-password" placeholder="รหัสผ่าน" value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "13px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 16, fontFamily: "Sarabun, sans-serif", background: "#fff", color: C.text }}
        />
        <button
          type="submit" disabled={loggingIn || !email.trim() || !password}
          style={{ padding: "13px 0", border: "none", borderRadius: 10, background: C.green, color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "Sarabun, sans-serif", cursor: loggingIn ? "default" : "pointer", opacity: loggingIn ? 0.6 : 1 }}
        >
          {loggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
      {loginError && <div style={{ color: C.red, fontSize: 13, marginTop: 16, fontWeight: 600 }}>อีเมลหรือรหัสผ่านไม่ถูกต้อง</div>}
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "Sarabun, sans-serif" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, background: "#fff", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>⚙️ Admin</div>
        <button onClick={handleLogout} style={{ padding: "5px 10px", background: C.redL, border: "1px solid #F5B4AE", borderRadius: 20, fontSize: 11, fontWeight: 600, color: C.red, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>🔒 ออกจากระบบ</button>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 16px" }}>
        {([["dashboard", "แดชบอร์ด"], ["settings", "ตั้งค่า"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, padding: "8px 0", border: `1px solid ${tab === key ? C.green : C.border}`, borderRadius: 10, background: tab === key ? C.greenL : "#fff", color: tab === key ? C.green : C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Audit Log</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
            การเปลี่ยนสถานะ/แก้ชื่อ/ลบออเดอร์ล่าสุด — ยอดขายรวม/รายงานเต็มรูปแบบจะเพิ่มทีหลัง
          </div>
          {loadingAudit ? (
            <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 13 }}>กำลังโหลด...</div>
          ) : auditLog.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 12 }}>ยังไม่มีการเปลี่ยนแปลง</div>
          ) : auditLog.map((a) => (
            <div key={a.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontWeight: 600, color: C.text }}>
                  {a.action === "status_change" ? "เปลี่ยนสถานะ" : a.action === "rename" ? "แก้ชื่อ" : "ลบ"} — {a.target_type} #{a.target_id}
                </span>
                <span style={{ color: C.muted }}>{new Date(a.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div style={{ color: C.muted }}>
                {a.actor_id ? "โดย staff" : "โดยลูกค้า"}
                {a.detail?.from !== undefined && ` — ${JSON.stringify(a.detail.from)} → ${JSON.stringify(a.detail.to)}`}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "16px" }}>
          {loadingSettings ? (
            <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 13 }}>กำลังโหลด...</div>
          ) : (
            <>
              {flagged.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>🚩 ชื่อที่ถูกรายงาน ({flagged.length})</div>
                  {flagged.map((f) => (
                    <div key={f.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>&quot;{f.flagged_text}&quot;</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => handleResolveFlag(f.id, true, f.flagged_text)}
                          style={{ flex: 1, padding: "6px 0", border: "none", borderRadius: 8, background: C.red, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                          เพิ่มเข้า blacklist
                        </button>
                        <button onClick={() => handleResolveFlag(f.id, false)}
                          style={{ flex: 1, padding: "6px 0", border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
                          ไม่ใช่คำหยาบ (ปิดเรื่อง)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>รายการคำต้องห้าม ({blacklist.length})</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input
                  value={newWord} onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddWord(); }}
                  placeholder="เพิ่มคำใหม่..."
                  style={{ flex: 1, padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "Sarabun, sans-serif" }}
                />
                <button onClick={handleAddWord} style={{ padding: "9px 16px", border: "none", borderRadius: 8, background: C.green, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>เพิ่ม</button>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                ระบบจะ normalize คำอัตโนมัติ (ตัดช่องว่าง/ตัวอักษรซ้ำ/homoglyph) ก่อนเทียบเสมอ ไม่ต้องพิมพ์หลายรูปแบบ
              </div>
              {blacklist.map((w) => (
                <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.text, fontFamily: "monospace" }}>{w.word}</span>
                  <button onClick={() => handleRemoveWord(w.id)} style={{ border: "none", background: "transparent", color: C.red, cursor: "pointer", fontSize: 12 }}>ลบ</button>
                </div>
              ))}
              {blacklist.length === 0 && <div style={{ textAlign: "center", padding: 16, color: C.muted, fontSize: 12 }}>ยังไม่มีคำในรายการ</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
