"use client";
// ─── app/admin/page.tsx ───────────────────────────────────
// Admin — login เดียวกับครัว (Supabase Auth) แต่แยก route/แยก login คนละครั้ง
// เนื้อหา Dashboard + Settings จะเพิ่มใน Phase 3 (กันขายเกิน) และ Phase 4 (บล็อกคำหยาบ)

import { useEffect, useState } from "react";
import {
  getBlacklistWords, addBlacklistWord, removeBlacklistWord,
  getFlaggedNames, resolveFlaggedName,
  getAuditLog,
} from "@/lib/supabase";
import { useStaffAuth } from "@/lib/useStaffAuth";
import { StaffLoginScreen, type StaffLoginTheme } from "@/components/StaffLoginScreen";
import { StaffButton, type StaffButtonTheme } from "@/components/StaffButton";
import { StaffTextInput, type StaffTextInputTheme } from "@/components/StaffTextInput";

const C = {
  green: "#3B6B0F", greenL: "#EBF3DC",
  red: "#C0392B", redL: "#FDECEA",
  text: "#1C1A17", muted: "#7A7570", border: "#E2DDD6", bg: "#F5F3EE",
};

const adminLoginTheme: StaffLoginTheme = {
  ink: C.text, inkSoft: C.muted, panel: "#fff", accent: C.green,
  danger: C.red, border: C.border, bg: C.bg,
  fontHeading: "inherit", fontBody: "inherit", radius: 14,
  title: "Admin — PETPAL", subtitle: "เข้าสู่ระบบเพื่อใช้งาน", brandGlyph: "⚙️",
};

const dashboardTheme: StaffButtonTheme & StaffTextInputTheme = {
  ink: C.text, inkSoft: C.muted, panel: "#fff", accent: C.green,
  danger: C.red, border: C.border, fontHeading: "inherit", fontBody: "inherit", radius: 14,
};

// ── ปุ่มออกจากระบบ — มี hover feedback ─────────────────────
function LogoutButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: "5px 10px", background: hover ? "#FADBD8" : C.redL, border: "1px solid #F5B4AE",
        borderRadius: 20, fontSize: 11, fontWeight: 600, color: C.red, cursor: "pointer",
        fontFamily: "inherit", transition: "background-color .15s ease",
      }}>
      🔒 ออกจากระบบ
    </button>
  );
}

// ── แท็บ — มี hover + transition ────────────────────────────
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, padding: "8px 0", border: `1px solid ${active ? C.green : C.border}`, borderRadius: 10,
        background: active ? C.greenL : hover ? "#FAFAF7" : "#fff",
        color: active ? C.green : C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
        fontFamily: "inherit", transition: "background-color .15s ease, border-color .15s ease",
      }}>
      {children}
    </button>
  );
}

// ── การ์ดยกตัวเบา ๆ เมื่อ hover ────────────────────────────
function HoverCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        transition: "box-shadow .15s ease, transform .1s ease",
        boxShadow: hover ? "0 4px 10px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
        ...style,
      }}>
      {children}
    </div>
  );
}

// ── แถวคำต้องห้าม — ปุ่มลบจะเด่นขึ้นตอน hover ───────────────
function BlacklistRow({ word, onRemove }: { word: { id: number; word: string }; onRemove: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff",
        border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6,
        boxShadow: hover ? "0 4px 10px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
        transition: "box-shadow .15s ease",
      }}>
      <span style={{ fontSize: 13, color: C.text, fontFamily: "monospace" }}>{word.word}</span>
      <button onClick={onRemove}
        style={{ border: "none", background: "transparent", color: C.red, cursor: "pointer", fontSize: 12, opacity: hover ? 1 : 0.45, transition: "opacity .15s ease" }}>
        ลบ
      </button>
    </div>
  );
}

// ── โครง loading แบบ skeleton pulse ────────────────────────
function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: 44, borderRadius: 8, background: C.border, opacity: 0.5, marginBottom: 6,
          animation: "staffPulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.12}s`,
        }} />
      ))}
    </div>
  );
}

// ── สถานะว่าง — ไอคอน + หัวข้อ + คำอธิบาย ───────────────────
function EmptyState({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 16px", color: C.muted }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{title}</div>
    </div>
  );
}

export default function AdminPage() {
  const auth = useStaffAuth();
  const [tab, setTab] = useState<"dashboard" | "settings">("dashboard");
  const [blacklist, setBlacklist] = useState<{ id: number; word: string; created_at: string }[]>([]);
  const [flagged, setFlagged] = useState<{ id: number; order_id: number | null; flagged_text: string; created_at: string }[]>([]);
  const [newWord, setNewWord] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [auditLog, setAuditLog] = useState<{ id: number; actor_id: string | null; action: string; target_type: string; target_id: number | null; detail: any; created_at: string }[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // ตั้งค่าโหลดใหม่ก่อนดึงข้อมูล — เรียกจาก event handler (คลิกแท็บ/login สำเร็จ)
  // แทนที่จะเรียก setState ตรง ๆ ในตัว effect (react-hooks/set-state-in-effect)
  const setLoadingForTab = (t: "dashboard" | "settings") => {
    if (t === "dashboard") setLoadingAudit(true); else setLoadingSettings(true);
  };

  useEffect(() => {
    if (!auth.unlocked || tab !== "dashboard") return;
    getAuditLog(50).then(setAuditLog).finally(() => setLoadingAudit(false));
  }, [auth.unlocked, tab]);

  useEffect(() => {
    if (!auth.unlocked || tab !== "settings") return;
    Promise.all([getBlacklistWords(), getFlaggedNames()])
      .then(([b, f]) => { setBlacklist(b); setFlagged(f); })
      .finally(() => setLoadingSettings(false));
  }, [auth.unlocked, tab]);

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

  if (!auth.unlocked) return <StaffLoginScreen auth={auth} theme={adminLoginTheme} />;

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "inherit" }}>
      <style>{`@keyframes staffPulse { 0%, 100% { opacity: .5; } 50% { opacity: .2; } }`}</style>

      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, background: "#fff", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>⚙️ Admin</div>
        <LogoutButton onClick={auth.handleLogout} />
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 16px" }}>
        {([["dashboard", "แดชบอร์ด"], ["settings", "ตั้งค่า"]] as const).map(([key, label]) => (
          <TabButton key={key} active={tab === key} onClick={() => { if (tab !== key) setLoadingForTab(key); setTab(key); }}>{label}</TabButton>
        ))}
      </div>

      {tab === "dashboard" ? (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Audit Log</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
            การเปลี่ยนสถานะ/แก้ชื่อ/ลบออเดอร์ล่าสุด — ยอดขายรวม/รายงานเต็มรูปแบบจะเพิ่มทีหลัง
          </div>
          {loadingAudit ? (
            <SkeletonRows />
          ) : auditLog.length === 0 ? (
            <EmptyState icon="🗒️" title="ยังไม่มีการเปลี่ยนแปลง" />
          ) : auditLog.map((a) => (
            <HoverCard key={a.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: C.text, marginBottom: 3 }}>
                {a.action === "status_change" ? "เปลี่ยนสถานะ" : a.action === "rename" ? "แก้ชื่อ" : "ลบ"} — {a.target_type} #{a.target_id}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 11 }}>
                <span>
                  {a.actor_id ? "โดย staff" : "โดยลูกค้า"}
                  {a.detail?.from !== undefined && ` — ${JSON.stringify(a.detail.from)} → ${JSON.stringify(a.detail.to)}`}
                </span>
                <span>{new Date(a.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </HoverCard>
          ))}
        </div>
      ) : (
        <div style={{ padding: "16px" }}>
          {loadingSettings ? (
            <SkeletonRows />
          ) : (
            <>
              {flagged.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>🚩 ชื่อที่ถูกรายงาน ({flagged.length})</div>
                  {flagged.map((f) => (
                    <HoverCard key={f.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>&quot;{f.flagged_text}&quot;</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <StaffButton variant="danger" theme={dashboardTheme} style={{ flex: 1, padding: "6px 0", fontSize: 12 }}
                          onClick={() => handleResolveFlag(f.id, true, f.flagged_text)}>
                          เพิ่มเข้า blacklist
                        </StaffButton>
                        <StaffButton variant="secondary" theme={dashboardTheme} style={{ flex: 1, padding: "6px 0", fontSize: 12 }}
                          onClick={() => handleResolveFlag(f.id, false)}>
                          ไม่ใช่คำหยาบ (ปิดเรื่อง)
                        </StaffButton>
                      </div>
                    </HoverCard>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>รายการคำต้องห้าม ({blacklist.length})</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <StaffTextInput
                  value={newWord} onChange={setNewWord} placeholder="เพิ่มคำใหม่..." theme={dashboardTheme}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddWord(); }}
                  style={{ padding: "9px 12px", fontSize: 14 }}
                />
                <StaffButton variant="primary" theme={dashboardTheme} style={{ padding: "0 18px", fontSize: 13 }} onClick={handleAddWord}>
                  เพิ่ม
                </StaffButton>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                ระบบจะ normalize คำอัตโนมัติ (ตัดช่องว่าง/ตัวอักษรซ้ำ/homoglyph) ก่อนเทียบเสมอ ไม่ต้องพิมพ์หลายรูปแบบ
              </div>
              {blacklist.map((w) => (
                <BlacklistRow key={w.id} word={w} onRemove={() => handleRemoveWord(w.id)} />
              ))}
              {blacklist.length === 0 && <EmptyState icon="📋" title="ยังไม่มีคำในรายการ" />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
