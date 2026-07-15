-- Phase 1: Auth (Admin + Kitchen รวมเป็น staff เดียวกัน) + RLS + ปิด IDOR บน orders
-- รันหลัง 0001_drop_departments.sql
-- ⚠️ รันบน dev/staging project ก่อนเสมอ

begin;

create extension if not exists pgcrypto;

-- ── staff ────────────────────────────────────────────────
-- ผูกกับ Supabase Auth user โดยตรง (id เดียวกับ auth.users.id)
-- ไม่มีการสมัครเองจากหน้าเว็บ — สร้างบัญชีผ่าน Supabase Dashboard เท่านั้น
create table if not exists staff (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table staff enable row level security;

create policy "staff_select_own_row"
  on staff for select
  to authenticated
  using (auth.uid() = id);

-- ── access_token สำหรับปิด IDOR (ลูกค้าแก้ชื่อ/ยกเลิกออเดอร์ตัวเองได้
--    เฉพาะตอนรู้ token ที่ได้รับตอนสร้างออเดอร์เท่านั้น) ──────────
alter table orders        add column if not exists access_token uuid not null default gen_random_uuid();
alter table custom_orders add column if not exists access_token uuid not null default gen_random_uuid();

-- อ่านค่า header "x-order-token" ที่ client แนบมาตอนเรียก UPDATE
create or replace function request_order_token() returns text as $$
  select current_setting('request.headers', true)::json ->> 'x-order-token';
$$ language sql stable;

-- ── orders ───────────────────────────────────────────────
alter table orders enable row level security;

-- ลูกค้า (anon) สร้างออเดอร์ได้เสมอ
create policy "orders_anon_insert" on orders
  for insert to anon
  with check (status = 'new');

-- ลูกค้าดูออเดอร์ได้ (จำเป็นสำหรับหน้าสถานะ/realtime) — หมายเหตุ: ยังเป็น
-- read-IDOR ที่เหลืออยู่ (เดา id แล้วดูชื่อ/รายการได้) แต่ไม่ใช่ scope ที่ตกลง
-- แก้ใน Phase 1 นี้ (ตกลงกันว่าปิดเฉพาะฝั่งแก้ไข/ยกเลิก) — พิจารณาแก้เพิ่มทีหลัง
create policy "orders_anon_select" on orders
  for select to anon
  using (true);

-- ลูกค้าแก้ชื่อ/ยกเลิกออเดอร์ตัวเองได้ เฉพาะออเดอร์ที่ยังไม่เริ่มทำ (new)
-- และต้องรู้ access_token ที่ถูกต้องเท่านั้น (ปิด IDOR)
-- with check บังคับว่าห้ามเปลี่ยน status ไปเป็นอย่างอื่นนอกจาก new/cancelled เอง
-- (กันลูกค้าสั่ง UPDATE status='done' ข้ามคิว)
create policy "orders_anon_update_own" on orders
  for update to anon
  using (status = 'new' and access_token::text = request_order_token())
  with check (status in ('new', 'cancelled'));

-- staff (login แล้ว) เห็น/แก้/ลบออเดอร์ได้ทั้งหมด
create policy "orders_staff_select" on orders for select to authenticated using (true);
create policy "orders_staff_update" on orders for update to authenticated using (true) with check (true);
create policy "orders_staff_delete" on orders for delete to authenticated using (true);

-- ── custom_orders ────────────────────────────────────────
alter table custom_orders enable row level security;

create policy "custom_orders_anon_insert" on custom_orders
  for insert to anon
  with check (status = 'new');

create policy "custom_orders_anon_select" on custom_orders
  for select to anon
  using (true);

create policy "custom_orders_staff_select" on custom_orders for select to authenticated using (true);
create policy "custom_orders_staff_update" on custom_orders for update to authenticated using (true) with check (true);
create policy "custom_orders_staff_delete" on custom_orders for delete to authenticated using (true);

-- ── menu_items ───────────────────────────────────────────
alter table menu_items enable row level security;

create policy "menu_items_anon_select" on menu_items for select to anon using (true);
create policy "menu_items_staff_select" on menu_items for select to authenticated using (true);
create policy "menu_items_staff_insert" on menu_items for insert to authenticated with check (true);
create policy "menu_items_staff_update" on menu_items for update to authenticated using (true) with check (true);
create policy "menu_items_staff_delete" on menu_items for delete to authenticated using (true);

-- ── announcements ────────────────────────────────────────
alter table announcements enable row level security;

create policy "announcements_anon_select" on announcements for select to anon using (true);
create policy "announcements_staff_select" on announcements for select to authenticated using (true);
create policy "announcements_staff_insert" on announcements for insert to authenticated with check (true);

-- ── menu_history_log ─────────────────────────────────────
alter table menu_history_log enable row level security;

create policy "menu_history_staff_select" on menu_history_log for select to authenticated using (true);
create policy "menu_history_staff_insert" on menu_history_log for insert to authenticated with check (true);

commit;
