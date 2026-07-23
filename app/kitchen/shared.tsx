// ─── app/kitchen/shared.tsx ───────────────────────────────
// Theme, format helpers, icons และชิ้นส่วน UI เล็ก ๆ ที่ใช้ร่วมกัน
// ระหว่างหน้าจอครัว — แยกออกมาจาก page.tsx เพื่อลดขนาดไฟล์เดียว

// ── สี & ฟอนต์ (Paper / Clipboard theme) ────────────────────
export const C = {
  bg:     "#F7F2E7",
  paper:  "#FFFFFF",
  paper2: "#FBF7EE",
  line:   "#E1D6BE",
  ink:    "#2B2A26",
  inkSoft:"#807A6B",

  sage:   "#5F7F63",
  sageBg: "#E5EBDF",
  ochre:  "#B5842E",
  ochreBg:"#F4E7CC",
  plum:   "#8C3A4B",
  plumBg: "#F3DEE1",

  photoBg: "#EFE7D4",
};
export const FD = "'Taviraj', serif";
export const FB = "'Noto Sans Thai', sans-serif";
export const FM = "'Courier Prime', monospace";
export const DEFAULT_CATS = ["ข้าว", "ก๋วยเตี๋ยว", "เครื่องดื่ม"];

// ── Helpers ───────────────────────────────────────────────
export const fmtElapsed = (s: string, ref?: string | null) => {
  const base = ref ? new Date(ref) : new Date(s);
  const min = Math.floor((Date.now() - base.getTime()) / 60000);
  return `${min} นาทีที่แล้ว`;
};
export const fmtTime = (s: string) => new Date(s).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
export const fmtDate = (s: string) =>
  new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const orderCode = (id: number) => `#${String(7000 + id).slice(-4)}`;

export const stateTagStyle = (kind: "pending" | "cooking" | "attn") => ({
  fontSize: 11, fontWeight: 700, padding: "3px 11px", borderRadius: 3, fontFamily: FD,
  background: kind === "pending" ? C.ochreBg : kind === "attn" ? C.plumBg : C.sageBg,
  color:      kind === "pending" ? C.ochre   : kind === "attn" ? C.plum   : C.sage,
} as const);

// ── Icons (เล็ก ๆ ใช้ซ้ำ) ───────────────────────────────────
export const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 12, height: 12 }}><path d="M4 12l5 5L20 6" /></svg>
);
export const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 12, height: 12 }}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconPhoto = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 26, height: 26 }}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-4 4-2-2-6 6" /></svg>
);
export const IconLock = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ width: 16, height: 16 }}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);

// ── "ตั๋ว" การ์ดออเดอร์ — เทป+ขอบฉีก ─────────────────────────
export function TicketShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.paper2, border: `1px solid ${C.line}`, borderRadius: 2, position: "relative", paddingTop: 14, marginBottom: 8 }}>
      <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", width: 46, height: 16, background: "#B7BDBE", borderRadius: 3, boxShadow: "0 2px 3px rgba(0,0,0,0.2)" }} />
      {children}
      <div style={{ position: "absolute", bottom: -6, left: 0, right: 0, height: 12, backgroundImage: `linear-gradient(135deg, transparent 50%, ${C.bg} 50%)`, backgroundSize: "10px 12px", backgroundRepeat: "repeat-x" }} />
    </div>
  );
}
