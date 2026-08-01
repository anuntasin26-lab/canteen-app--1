// ─── app/kitchen/shared.tsx ───────────────────────────────
// Theme, format helpers, icons และชิ้นส่วน UI เล็ก ๆ ที่ใช้ร่วมกัน
// ระหว่างหน้าจอครัว — แยกออกมาจาก page.tsx เพื่อลดขนาดไฟล์เดียว

// ── สี & ฟอนต์ (KDS: จอครัวคอนทราสต์สูง พื้นเข้ม ตัวอักษรใหญ่) ──
export const C = {
  bg:     "#141412",
  paper:  "#1E1E1A",
  paper2: "#242420",
  line:   "#3C3C36",
  ink:    "#F5F3EC",
  inkSoft:"#A9A599",

  sage:   "#8FCB82",
  sageBg: "#20331F",
  ochre:  "#F2B84D",
  ochreBg:"#3A2C14",
  plum:   "#E8778A",
  plumBg: "#3A1B22",

  photoBg: "#2A2A24",
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
  fontSize: 13, fontWeight: 700, padding: "5px 14px", borderRadius: 20, fontFamily: FD,
  background: kind === "pending" ? C.ochreBg : kind === "attn" ? C.plumBg : C.sageBg,
  color:      kind === "pending" ? C.ochre   : kind === "attn" ? C.plum   : C.sage,
} as const);

// ── Icons (เล็ก ๆ ใช้ซ้ำ) ───────────────────────────────────
export const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} style={{ width: 18, height: 18 }}><path d="M4 12l5 5L20 6" /></svg>
);
export const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} style={{ width: 18, height: 18 }}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconPhoto = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 26, height: 26 }}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-4 4-2-2-6 6" /></svg>
);
export const IconLock = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ width: 16, height: 16 }}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);

// ── การ์ดตั๋วออเดอร์ — เรียบ คอนทราสต์สูง อ่านง่ายจากระยะไกล ───
export function TicketShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.paper2, border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      {children}
    </div>
  );
}
