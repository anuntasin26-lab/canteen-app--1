// ─── app/kitchen/components/LoginScreen.tsx ──────────────
import { C, FD, FB, FM } from "../shared";

export function LoginScreen({
  email, setEmail, password, setPassword, loginError, loggingIn, onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loginError: boolean;
  loggingIn: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Taviraj:wght@500;600;700&family=Noto+Sans+Thai:wght@400;500;600&family=Courier+Prime:wght@400;700&display=swap');`}</style>
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: FB, padding: 24 }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", border: `2px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, fontFamily: FD, marginBottom: 20, background: C.paper }}>PP</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginBottom: 6, fontFamily: FD }}>ครัว PETPAL</div>
        <div style={{ fontSize: 14, color: C.inkSoft, marginBottom: 28, fontFamily: FM }}>เข้าสู่ระบบเพื่อใช้งาน</div>
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 300, width: "100%" }}
        >
          <input
            type="email" autoComplete="username" placeholder="อีเมล" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "16px 18px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 16, fontFamily: FM, background: C.paper2, color: C.ink }}
          />
          <input
            type="password" autoComplete="current-password" placeholder="รหัสผ่าน" value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "16px 18px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 16, fontFamily: FM, background: C.paper2, color: C.ink }}
          />
          <button
            type="submit" disabled={loggingIn || !email.trim() || !password}
            style={{ padding: "16px 0", border: "none", borderRadius: 10, background: C.ochre, color: C.paper, fontSize: 17, fontWeight: 600, fontFamily: FD, cursor: loggingIn ? "default" : "pointer", opacity: loggingIn ? 0.6 : 1 }}
          >
            {loggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        {loginError && <div style={{ color: C.plum, fontSize: 14, marginTop: 18, fontWeight: 700, fontFamily: FD }}>อีเมลหรือรหัสผ่านไม่ถูกต้อง</div>}
      </div>
    </>
  );
}
