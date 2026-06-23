"use client";
// ─── app/menu/page.tsx ────────────────────────────────────
// Redirect ไป /kitchen — หน้าจัดการเมนูรวมอยู่ที่นั่นแล้ว
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MenuRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/kitchen"); }, [router]);
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Sarabun, sans-serif", color: "#5C5852" }}>
      กำลังเปลี่ยนหน้า...
    </div>
  );
}
