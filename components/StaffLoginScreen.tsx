"use client";
// ─── components/StaffLoginScreen.tsx ──────────────────────
// หน้า login ที่ /kitchen และ /admin ใช้ร่วมกัน (login / ลืมรหัสผ่าน / ส่งแล้ว)
// ธีม (สี/ฟอนต์/ข้อความ) กำหนดแยกต่อหน้า ผ่าน prop `theme` เพื่อคงเอกลักษณ์เดิมของแต่ละหน้า

import { useEffect, useState } from "react";
import type { StaffAuth } from "@/lib/useStaffAuth";
import { StaffButton, type StaffButtonTheme } from "./StaffButton";
import { StaffTextInput, type StaffTextInputTheme } from "./StaffTextInput";

export interface StaffLoginTheme extends StaffButtonTheme, StaffTextInputTheme {
  bg: string;
  fontMono?: string;
  title: string;
  subtitle: string;
  brandGlyph: React.ReactNode;
  googleFontsHref?: string;
}

export function StaffLoginScreen({ auth, theme }: { auth: StaffAuth; theme: StaffLoginTheme }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const subtitleFont = theme.fontMono ?? theme.fontBody;

  return (
    <>
      <style>{`
        ${theme.googleFontsHref ? `@import url('${theme.googleFontsHref}');` : ""}
        @keyframes staffViewIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes staffShake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
      `}</style>
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: theme.bg, fontFamily: theme.fontBody, padding: 24,
      }}>
        <div style={{
          width: "100%", maxWidth: 340, background: theme.panel, border: `1px solid ${theme.border}`,
          borderRadius: theme.radius, padding: 40,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.07)",
          opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(10px)",
          transition: "opacity .4s ease, transform .4s ease",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <div style={{
            width: 76, height: 76, borderRadius: "50%", border: `2px solid ${theme.ink}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700,
            fontFamily: theme.fontHeading, marginBottom: 18, background: theme.panel, color: theme.ink,
          }}>
            {theme.brandGlyph}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.ink, marginBottom: 6, fontFamily: theme.fontHeading, textAlign: "center" }}>
            {theme.title}
          </div>
          <div style={{ fontSize: 13, color: theme.inkSoft, marginBottom: 26, fontFamily: subtitleFont, textAlign: "center" }}>
            {theme.subtitle}
          </div>

          <div key={auth.view} style={{ width: "100%", animation: "staffViewIn .25s ease" }}>
            {auth.view === "login" && (
              <>
                <form
                  onSubmit={(e) => { e.preventDefault(); auth.handleLogin(); }}
                  style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}
                >
                  <StaffTextInput
                    type="email" autoComplete="username" placeholder="อีเมล"
                    value={auth.email} onChange={auth.setEmail} theme={theme}
                  />
                  <StaffTextInput
                    type="password" autoComplete="current-password" placeholder="รหัสผ่าน"
                    value={auth.password} onChange={auth.setPassword} theme={theme}
                  />
                  <StaffButton type="submit" variant="primary" fullWidth theme={theme}
                    disabled={auth.loggingIn || !auth.email.trim() || !auth.password}>
                    {auth.loggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                  </StaffButton>
                </form>
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <StaffButton variant="ghost" theme={theme} onClick={auth.openForgotPassword} style={{ fontSize: 13, padding: 0 }}>
                    ลืมรหัสผ่าน?
                  </StaffButton>
                </div>
                {auth.loginError && (
                  <div style={{
                    color: theme.danger, fontSize: 14, marginTop: 16, fontWeight: 700, textAlign: "center",
                    fontFamily: theme.fontHeading, animation: "staffShake .35s ease",
                  }}>
                    อีเมลหรือรหัสผ่านไม่ถูกต้อง
                  </div>
                )}
              </>
            )}

            {auth.view === "forgot" && (
              <>
                <div style={{ fontSize: 13, color: theme.inkSoft, marginBottom: 16, textAlign: "center", fontFamily: theme.fontBody, lineHeight: 1.6 }}>
                  กรอกอีเมลที่ใช้เข้าสู่ระบบ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
                </div>
                <form
                  onSubmit={(e) => { e.preventDefault(); auth.handleRequestReset(); }}
                  style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}
                >
                  <StaffTextInput
                    type="email" autoComplete="username" placeholder="อีเมล" autoFocus
                    value={auth.resetEmail} onChange={auth.setResetEmail} theme={theme}
                  />
                  <StaffButton type="submit" variant="primary" fullWidth theme={theme}
                    disabled={auth.resetSending || !auth.resetEmail.trim()}>
                    {auth.resetSending ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
                  </StaffButton>
                </form>
                {auth.resetError && (
                  <div style={{
                    color: theme.danger, fontSize: 13, marginTop: 14, fontWeight: 700, textAlign: "center",
                    fontFamily: theme.fontHeading, animation: "staffShake .35s ease",
                  }}>
                    ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง
                  </div>
                )}
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <StaffButton variant="ghost" theme={theme} onClick={auth.backToLogin} style={{ fontSize: 13, padding: 0 }}>
                    ← กลับไปเข้าสู่ระบบ
                  </StaffButton>
                </div>
              </>
            )}

            {auth.view === "forgot-sent" && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📩</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: theme.ink, fontFamily: theme.fontHeading, marginBottom: 6 }}>
                  ส่งอีเมลแล้ว
                </div>
                <div style={{ fontSize: 13, color: theme.inkSoft, fontFamily: theme.fontBody, marginBottom: 20, lineHeight: 1.6 }}>
                  ตรวจสอบกล่องจดหมายของ<br /><b style={{ color: theme.ink }}>{auth.resetEmail}</b><br />สำหรับลิงก์ตั้งรหัสผ่านใหม่
                </div>
                <StaffButton variant="ghost" theme={theme} onClick={auth.backToLogin} style={{ fontSize: 13, padding: 0 }}>
                  ← กลับไปเข้าสู่ระบบ
                </StaffButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
