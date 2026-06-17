"use client";
// ─── app/menu-history/page.tsx ────────────────────────────
// ดูเมนูย้อนหลัง — ครัวเข้าผ่าน PIN เดียวกัน

import { useEffect, useState } from "react";
import { getMenuHistory } from "@/lib/supabase";

const MENU_PIN = process.env.NEXT_PUBLIC_KITCHEN_PIN ?? "1234";

const C = {
  green: "#3B6B0F", greenL: "#EBF3DC",
  red: "#C0392B", redL: "#FDECEA",
  text: "#1C1A17", muted: "#7A7570", border: "#E2DDD6", bg: "#F5F3EE",
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function MenuHistoryPage() {
  const [pin,      setPin]      = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [logs,     setLogs]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [days,     setDays]     = useState(7);

  const handlePin = (p: string) => {
    setPin(p);
    if (p.length === 4) {
      if (p === MENU_PIN) { setUnlocked(true); setPinError(false); }
      else { setPinError(true); setTimeout(() => { setPin(""); setPinError(false); }, 800); }
    }
  };

  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    getMenuHistory(days).then(setLogs).finally(() => setLoading(false));
  }, [unlocked, days]);

  // จัดกลุ่มตามวัน
  const grouped: Record<string, any[]> = {};
  logs.forEach(log => {
    const day = new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(log);
  });

  if (!unlocked) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "Sarabun, sans-serif", padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🕐</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>ประวัติเมนู</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 32 }}>ใส่ PIN เพื่อเข้าใช้งาน</div>
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: pin.length > i ? (pinError ? C.red : C.green) : C.border, transition: "background .15s" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 240, width: "100%" }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n, i) => (
          <button key={i}
            onClick={() => {
              if (n === "⌫") setPin(p => p.slice(0,-1));
              else if (n !== "") handlePin(pin + String(n));
            }}
            style={{ padding: "18px 0", border: `1px solid ${C.border}`, borderRadius: 12, background: n === "" ? "transparent" : "#fff", fontSize: 20, fontWeight: 600, cursor: n === "" ? "default" : "pointer", color: C.text, fontFamily: "Sarabun, sans-serif" }}>
            {n}
          </button>
        ))}
      </div>
      {pinError && <div style={{ color: C.red, fontSize: 13, marginTop: 16, fontWeight: 600 }}>PIN ไม่ถูกต้อง</div>}
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "Sarabun, sans-serif" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, background: "#fff", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>🕐 ประวัติเมนู</div>
          <div style={{ fontSize: 11, color: C.muted }}>การแก้ไขเมนูที่ผ่านมา</div>
        </div>
        <button onClick={() => setUnlocked(false)} style={{ padding: "5px 10px", background: C.redL, border: `1px solid #F5B4AE`, borderRadius: 20, fontSize: 11, fontWeight: 600, color: C.red, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>🔒 ล็อก</button>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 16px" }}>
        {[3, 7, 30].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ flex: 1, padding: "7px 0", border: `1px solid ${days === d ? C.green : C.border}`, borderRadius: 10, background: days === d ? C.greenL : "#fff", color: days === d ? C.green : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Sarabun, sans-serif" }}>
            {d} วัน
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: C.muted }}>กำลังโหลด...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>ไม่มีประวัติในช่วงนี้</div>
        ) : Object.entries(grouped).map(([day, dayLogs]) => (
          <div key={day} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, paddingLeft: 4 }}>{day}</div>
            {dayLogs.map((log, i) => (
              <div key={i} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{log.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: log.available ? C.greenL : C.redL, color: log.available ? C.green : C.red }}>
                    {log.available ? "เปิด" : "ปิด"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginTop: 4 }}>
                  <span>{fmtDate(log.created_at)}</span>
                  <span style={{ color: C.green, fontWeight: 700 }}>{log.price} บาท</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
