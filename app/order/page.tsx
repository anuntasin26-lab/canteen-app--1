"use client";
// ─── app/order/page.tsx ───────────────────────────────────
// /order เองไม่มี UI — แค่ตัดสินใจว่าจะพาไปหน้าไหนตาม state ที่ restore มา
// (มีออเดอร์ค้างวันนี้ → /order/status, มีชื่อบันทึกไว้ → /order/menu,
//  ไม่มีอะไรเลย → /order/name) ทำแบบนี้แทนการเดา query param แบบเดิม

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "./OrderContext";

export default function OrderIndexPage() {
  const router = useRouter();
  const { loading, order, name } = useOrder();

  useEffect(() => {
    if (loading) return;
    if (order) router.replace("/order/status");
    else if (name) router.replace("/order/menu");
    else router.replace("/order/name");
  }, [loading, order, name, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", fontFamily: "Sarabun, sans-serif", color: "#7A7570" }}>
      กำลังโหลด...
    </div>
  );
}
