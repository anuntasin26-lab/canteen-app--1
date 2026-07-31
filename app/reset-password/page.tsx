"use client";
// ─── app/reset-password/page.tsx ──────────────────────────
// ปลายทางของลิงก์รีเซ็ตรหัสผ่านจากอีเมล — ใช้ recovery session ชั่วคราว
// (detectSessionInUrl ของ supabase-js เป็น true โดย default แม้ persistSession จะเป็น false)

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, updateStaffPassword, signOutStaff } from "@/lib/supabase";
import { StaffButton, type StaffButtonTheme } from "@/components/StaffButton";
import { StaffTextInput, type StaffTextInputTheme } from "@/components/StaffTextInput";

type Status = "checking" | "ready" | "invalid" | "submitting" | "done" | "error";

const C = {
  bg: "#EEF0F2", panel: "#FFFFFF", border: "#DDE1E6",
  ink: "#20242B", inkSoft: "#6B7280", accent: "#33415C", danger: "#C0392B",
};
const FONT = "inherit";
const theme: StaffButtonTheme & StaffTextInputTheme = {
  ink: C.ink, inkSoft: C.inkSoft, panel: C.panel, accent: C.accent,
  danger: C.danger, border: C.border, fontHeading: FONT, fontBody: FONT, radius: 12,
};

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus((s) => (s === "checking" ? "ready" : s));
    });
    const t = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const handleSubmit = async () => {
    setValidationError("");
    if (pw1.length < 8) { setValidationError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (pw1 !== pw2) { setValidationError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setStatus("submitting");
    try {
      await updateStaffPassword(pw1);
      await signOutStaff();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: C.bg, padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 360, background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 40,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.07)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>🔑</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: C.ink, marginBottom: 20 }}>
          ตั้งรหัสผ่านใหม่
        </div>

        {status === "checking" && (
          <div style={{ color: C.inkSoft, fontSize: 14 }}>กำลังตรวจสอบลิงก์...</div>
        )}

        {status === "invalid" && (
          <>
            <div style={{ color: C.inkSoft, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว<br />กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link href="/kitchen" style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>ไปหน้าครัว</Link>
              <Link href="/admin" style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>ไปหน้า Admin</Link>
            </div>
          </>
        )}

        {(status === "ready" || status === "submitting") && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
            style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}
          >
            <StaffTextInput
              type="password" autoComplete="new-password" placeholder="รหัสผ่านใหม่"
              value={pw1} onChange={setPw1} theme={theme} disabled={status === "submitting"}
            />
            <StaffTextInput
              type="password" autoComplete="new-password" placeholder="ยืนยันรหัสผ่านใหม่"
              value={pw2} onChange={setPw2} theme={theme} disabled={status === "submitting"}
            />
            {validationError && (
              <div style={{ color: C.danger, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                {validationError}
              </div>
            )}
            <StaffButton type="submit" variant="primary" fullWidth theme={theme}
              disabled={status === "submitting" || !pw1 || !pw2}>
              {status === "submitting" ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </StaffButton>
          </form>
        )}

        {status === "done" && (
          <>
            <div style={{ color: C.ink, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              เปลี่ยนรหัสผ่านสำเร็จ
            </div>
            <div style={{ color: C.inkSoft, fontSize: 13, marginBottom: 20 }}>
              เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link href="/kitchen" style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>ไปหน้าครัว</Link>
              <Link href="/admin" style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>ไปหน้า Admin</Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ color: C.danger, fontSize: 14, marginBottom: 16 }}>
              เกิดข้อผิดพลาด ลองอีกครั้ง
            </div>
            <StaffButton variant="secondary" theme={theme} onClick={() => setStatus("ready")}>
              ลองอีกครั้ง
            </StaffButton>
          </>
        )}
      </div>
    </div>
  );
}
