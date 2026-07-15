"use client";
// ─── app/order/OrderContext.tsx ───────────────────────────
// state/logic ที่ใช้ร่วมกันทุกหน้าใน /order/* (name, menu, cart, custom,
// custom-done, status) — เดิมทั้งหมดนี้อยู่ในไฟล์เดียว ตอนนี้แยก route จริง
// แต่ยังต้องแชร์ state กัน จึงยกขึ้นมาไว้ที่ Context ระดับ layout

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  getMenuItems,
  createOrder,
  addItemsToOrder,
  renameOwnOrder,
  cancelOwnOrder,
  getTodayAnnouncement,
  subscribeToAnnouncements,
  createCustomOrder,
  supabase,
} from "@/lib/supabase";
import type { MenuItem, Order } from "@/types";
import { addToCart, subFromCart, cartTotal, cartItemCount, isMenuItemVisible } from "@/lib/cart-utils";

const LS_NAME     = "petpal_name";
const LS_ORDER_ID = "petpal_order_id";

type ModalState = { message: string; tone?: "error" | "info" } | null;

interface OrderContextValue {
  menuItems: MenuItem[];
  loading: boolean;
  error: string | null;
  name: string; setName: (s: string) => void;
  cart: Record<number, number>;
  note: string; setNote: (s: string) => void;
  cat: string; setCat: (s: string) => void;
  order: Order | null;
  submitting: boolean;
  announcement: string | null;
  showBanner: boolean; setShowBanner: (b: boolean) => void;
  editingName: boolean; setEditingName: (b: boolean) => void;
  newName: string; setNewName: (s: string) => void;
  savingName: boolean;
  cancelling: boolean;
  customItems: string; setCustomItems: (s: string) => void;
  customNote: string; setCustomNote: (s: string) => void;
  customSubmitting: boolean;
  modal: ModalState;
  closeModal: () => void;
  CATS: string[];
  filtered: MenuItem[];
  cartItems: MenuItem[];
  total: number;
  itemCount: number;
  add: (id: number) => void;
  sub: (id: number) => void;
  handleGoMenu: () => void;
  handleConfirm: () => Promise<void>;
  handleSaveName: () => Promise<void>;
  handleCancel: () => Promise<void>;
  handleReorder: () => void;
  handleCustomSubmit: () => Promise<void>;
  refreshMenu: () => void;
}

const OrderContext = createContext<OrderContextValue | null>(null);

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder ต้องถูกเรียกใน OrderProvider เท่านั้น");
  return ctx;
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const [menuItems,   setMenuItems]   = useState<MenuItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [customItems,  setCustomItems]  = useState("");
  const [customNote,   setCustomNote]   = useState("");
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [name,        setName]        = useState("");
  const [cart,        setCart]        = useState<Record<number, number>>({});
  const [note,        setNote]        = useState("");
  const [cat,         setCat]         = useState("ทั้งหมด");
  const [order,       setOrder]       = useState<Order | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [announcement,  setAnnouncement]  = useState<string | null>(null);
  const [showBanner,    setShowBanner]    = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const [editingName,  setEditingName]  = useState(false);
  const [newName,      setNewName]      = useState("");
  const [savingName,   setSavingName]   = useState(false);
  const [cancelling,   setCancelling]   = useState(false);

  const showModal = (message: string, tone: "error" | "info" = "error") => setModal({ message, tone });
  const closeModal = () => setModal(null);
  const refreshMenu = () => { getMenuItems().then((m) => setMenuItems(m as MenuItem[])).catch(() => {}); };

  // ── โหลดเมนู + ตรวจ localStorage (ชื่อ/ออเดอร์ค้าง) ──────
  useEffect(() => {
    const savedName    = localStorage.getItem(LS_NAME) ?? "";
    const savedOrderId = localStorage.getItem(LS_ORDER_ID);

    getMenuItems()
      .then(async (m) => {
        setMenuItems(m as MenuItem[]);
        if (savedName) setName(savedName);

        if (savedOrderId) {
          try {
            const { data, error: oErr } = await supabase
              .from("orders_with_items").select("*").eq("id", Number(savedOrderId)).single();
            if (!oErr && data) {
              const orderDate = new Date(data.created_at);
              const today = new Date();
              const sameDay =
                orderDate.getFullYear() === today.getFullYear() &&
                orderDate.getMonth()    === today.getMonth()    &&
                orderDate.getDate()     === today.getDate();
              if (sameDay && data.status !== "cancelled") {
                setOrder(data);
              } else {
                localStorage.removeItem(LS_ORDER_ID);
              }
            } else {
              localStorage.removeItem(LS_ORDER_ID);
            }
          } catch {
            localStorage.removeItem(LS_ORDER_ID);
          }
        }
      })
      .catch(() => setError("โหลดข้อมูลไม่ได้ กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, []);

  // ── ประกาศ realtime ────────────────────────────────────
  useEffect(() => {
    getTodayAnnouncement().then((a) => {
      if (a) { setAnnouncement(a.message); setShowBanner(true); }
    });
    const ch = subscribeToAnnouncements((payload) => {
      setAnnouncement(payload.new.message);
      setShowBanner(true);
    });
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── รีเฟรชโควตาเมนูแบบ realtime ─────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel("menu-quota-watch")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_items" }, () => {
        refreshMenu();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── realtime ติดตาม order ────────────────────────────
  useEffect(() => {
    if (!order) return;
    const ch = supabase
      .channel(`order-${order.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: `id=eq.${order.id}`,
      }, (payload) => {
        setOrder((prev) => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [order?.id]);

  const CATS = ["ทั้งหมด", ...Array.from(new Set(menuItems.map((m) => m.category)))];
  const visibleItems = menuItems.filter(isMenuItemVisible);
  const filtered = cat === "ทั้งหมด" ? visibleItems : visibleItems.filter((m) => m.category === cat);
  const cartItems = menuItems.filter((m) => (cart[m.id] ?? 0) > 0);
  const total     = cartTotal(cartItems.map((m) => ({ price: m.price, qty: cart[m.id] })));
  const itemCount = cartItemCount(cart);

  const add = (id: number) => setCart((c) => addToCart(c, id));
  const subFn = (id: number) => setCart((c) => subFromCart(c, id));

  const handleGoMenu = () => {
    localStorage.setItem(LS_NAME, name.trim());
  };

  const handleConfirm = async () => {
    if (!name.trim() || cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const items = cartItems.map((m) => ({ id: m.id, qty: cart[m.id] }));

      if (order && order.status === "new") {
        try {
          const updated = await addItemsToOrder(order.id, order.access_token, items, note.trim() || undefined);
          setOrder(updated);
          setCart({});
          setNote("");
          return;
        } catch (mergeErr: any) {
          if (mergeErr?.code !== "ORDER_ALREADY_STARTED") throw mergeErr;
        }
      }

      const newOrder = await createOrder({
        customer_name: name.trim(),
        items,
        note: note.trim() || undefined,
      });
      localStorage.setItem(LS_ORDER_ID, String(newOrder.id));
      setOrder(newOrder);
      setCart({});
      setNote("");
    } catch (err: any) {
      if (err?.code === "SOLD_OUT") {
        showModal("ขออภัย เมนูบางรายการเต็มโควตาวันนี้แล้ว กรุณาเลือกใหม่");
        refreshMenu();
      } else if (err?.code === "MENU_ITEM_UNAVAILABLE") {
        showModal("ขออภัย เมนูบางรายการปิดขายไปแล้ว กรุณาเลือกใหม่");
        refreshMenu();
      } else if (err?.code === "OFFENSIVE_NAME") {
        showModal("ชื่อหรือหมายเหตุที่กรอกไม่เหมาะสม กรุณาแก้ไขก่อนส่งอีกครั้ง");
      } else if (err?.code === "RATE_LIMITED") {
        showModal("มีการสั่งอาหารถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
      } else {
        showModal("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
      throw err; // ให้หน้าเรียก (cart page) รู้ว่าไม่สำเร็จ จะได้ไม่ redirect ไป status
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveName = async () => {
    if (!order || !newName.trim()) return;
    setSavingName(true);
    try {
      await renameOwnOrder(order.id, order.access_token, newName.trim());
      setOrder((prev) => prev ? { ...prev, customer_name: newName.trim() } : prev);
      localStorage.setItem(LS_NAME, newName.trim());
      setName(newName.trim());
      setEditingName(false);
    } catch (err: any) {
      if (err?.code === "OFFENSIVE_NAME") {
        showModal("ชื่อที่กรอกไม่เหมาะสม กรุณาแก้ไขก่อนบันทึกอีกครั้ง");
      } else {
        showModal("แก้ไขชื่อไม่ได้ กรุณาลองใหม่");
      }
    } finally {
      setSavingName(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    const confirmed = window.confirm("ยืนยันยกเลิกออเดอร์นี้?");
    if (!confirmed) return;
    setCancelling(true);
    try {
      await cancelOwnOrder(order.id, order.access_token);
      localStorage.removeItem(LS_ORDER_ID);
      setOrder(null);
      setCart({});
      setNote("");
    } catch {
      showModal("ยกเลิกไม่ได้ กรุณาลองใหม่");
    } finally {
      setCancelling(false);
    }
  };

  const handleReorder = () => {
    setCart({});
    setNote("");
  };

  const handleCustomSubmit = async () => {
    if (!customItems.trim() || !name.trim()) return;
    setCustomSubmitting(true);
    try {
      await createCustomOrder({
        customer_name: name.trim(),
        items: customItems.trim(),
        note: customNote.trim() || undefined,
      });
      setCustomItems("");
      setCustomNote("");
    } catch (err: any) {
      if (err?.code === "OFFENSIVE_NAME") {
        showModal("ชื่อ, รายการ หรือหมายเหตุที่กรอกไม่เหมาะสม กรุณาแก้ไขก่อนส่งอีกครั้ง");
      } else if (err?.code === "RATE_LIMITED") {
        showModal("มีการส่งรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
      } else {
        showModal("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
      throw err;
    } finally {
      setCustomSubmitting(false);
    }
  };

  const value: OrderContextValue = {
    menuItems, loading, error,
    name, setName, cart, note, setNote, cat, setCat, order, submitting,
    announcement, showBanner, setShowBanner,
    editingName, setEditingName, newName, setNewName, savingName, cancelling,
    customItems, setCustomItems, customNote, setCustomNote, customSubmitting,
    modal, closeModal,
    CATS, filtered, cartItems, total, itemCount,
    add, sub: subFn,
    handleGoMenu, handleConfirm, handleSaveName, handleCancel, handleReorder, handleCustomSubmit,
    refreshMenu,
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}
