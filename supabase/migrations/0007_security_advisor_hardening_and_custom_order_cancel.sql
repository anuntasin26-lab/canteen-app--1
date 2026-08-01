-- =========================================================================
-- SECTION A: RLS policy cleanup — drop legacy always-true/duplicate policies
-- ที่ตกค้างจากรอบ refactor ก่อนหน้า ไม่มี code path ใน lib/supabase.ts ใช้งาน
-- และถูกแทนที่ด้วย RPC (SECURITY DEFINER) ไปแล้วตาม migration 0003/0005
-- =========================================================================

-- announcements: ลบนโยบาย insert แบบ public ที่ไม่มีใครใช้ + รวม SELECT ซ้ำ
drop policy if exists "announcements_insert_all" on announcements;

drop policy if exists "announcements_anon_select" on announcements;
drop policy if exists "announcements_staff_select" on announcements;
drop policy if exists "announcements_read_all" on announcements;
create policy "announcements_select_all" on announcements
  for select to anon, authenticated
  using (true);

-- menu_history_log: ลบนโยบาย insert แบบ public + ลบ SELECT ที่ซ้ำกับ staff_select
drop policy if exists "menu_history_insert_all" on menu_history_log;
drop policy if exists "menu_history_read_all" on menu_history_log;

-- menu_items: ลบ write policy แบบ public ที่ให้ใครก็แก้เมนูได้ + รวม SELECT ซ้ำ
drop policy if exists "menu_items_insert_all" on menu_items;
drop policy if exists "menu_items_update_all" on menu_items;
drop policy if exists "menu_items_delete_all" on menu_items;

drop policy if exists "menu_items_anon_select" on menu_items;
drop policy if exists "menu_items_staff_select" on menu_items;
drop policy if exists "menu_items_read_all" on menu_items;
create policy "menu_items_select_all" on menu_items
  for select to anon, authenticated
  using (true);

-- orders: ลบ write policy แบบ public (แทนที่ด้วย RPC ตั้งแต่ migration 0003 แล้ว) + รวม SELECT ซ้ำ
drop policy if exists "orders_insert_anon" on orders;
drop policy if exists "orders_update_status" on orders;

drop policy if exists "orders_anon_select" on orders;
drop policy if exists "orders_staff_select" on orders;
drop policy if exists "orders_read_all" on orders;
create policy "orders_select_all" on orders
  for select to anon, authenticated
  using (true);

-- staff: performance rewrite ของ RLS policy (semantics เดิมทุกประการ — แค่ลด
-- per-row re-evaluation ของ auth.uid() ตามคำแนะนำของ Supabase)
drop policy if exists "staff_select_own_row" on public.staff;
create policy "staff_select_own_row"
  on public.staff
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- =========================================================================
-- SECTION B: storage.objects — ปิดการ list ไฟล์ใน bucket menu-images แบบ public
-- (getPublicUrl() ยังใช้งานได้ปกติ เพราะ public bucket bypass RLS สำหรับการ
-- อ่านไฟล์ผ่าน URL อยู่แล้ว นโยบายนี้ปิดแค่การ enumerate/list เท่านั้น)
-- =========================================================================
drop policy if exists "menu images public read" on storage.objects;

-- =========================================================================
-- SECTION C: function search_path hardening (behavior-preserving)
-- =========================================================================
alter function public.request_order_token() set search_path = public, pg_temp;
alter function public.normalize_text(text) set search_path = public, pg_temp;
alter function public.normalize_blacklist_word() set search_path = public, pg_temp;
alter function public.contains_blacklisted_word(text) set search_path = public, pg_temp;

-- =========================================================================
-- SECTION D: missing FK indexes (purely additive, ไม่กระทบพฤติกรรม)
-- =========================================================================
create index if not exists idx_flagged_names_order_id on public.flagged_names (order_id);
create index if not exists idx_flagged_names_custom_order_id on public.flagged_names (custom_order_id);
create index if not exists idx_flagged_names_flagged_by on public.flagged_names (flagged_by);
create index if not exists idx_menu_history_log_menu_id on public.menu_history_log (menu_id);

-- =========================================================================
-- SECTION E: revoke unnecessary direct RPC EXECUTE grants — ยืนยันแล้วว่าไม่มี
-- client อื่นนอกจากเว็บแอปนี้เรียกฟังก์ชันสองตัวนี้โดยตรง
-- =========================================================================
revoke execute on function public.check_rate_limit(text, integer) from public, anon, authenticated;
revoke execute on function public.log_order_change() from public, anon, authenticated;

-- =========================================================================
-- SECTION F: custom_orders — ปิดช่องโหว่ที่ให้ใครก็แก้/ลบ custom order ของ
-- ใครก็ได้แบบไม่มีการเช็คเจ้าของเลย และเพิ่มฟีเจอร์ "ลูกค้ายกเลิกออเดอร์ตามสั่ง
-- ของตัวเอง" ผ่าน RPC ที่เช็ค access_token (คู่ขนานกับ cancel_own_order ของ
-- ออเดอร์เมนูปกติ)
-- =========================================================================
drop policy if exists "custom_insert_anon" on custom_orders;
drop policy if exists "custom_delete" on custom_orders;
drop policy if exists "custom_update" on custom_orders;

drop policy if exists "custom_orders_anon_select" on custom_orders;
drop policy if exists "custom_orders_staff_select" on custom_orders;
drop policy if exists "custom_read_all" on custom_orders;
create policy "custom_orders_select_all" on custom_orders
  for select to anon, authenticated
  using (true);
-- custom_orders_staff_update / custom_orders_staff_delete ไม่แตะต้อง
-- (authenticated-only ตั้งใจให้ staff จัดการได้เต็มสิทธิ์)

create or replace function cancel_own_custom_order(
  p_custom_order_id bigint,
  p_access_token uuid
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_token uuid;
begin
  select status, access_token into v_status, v_token
  from custom_orders where id = p_custom_order_id for update;

  if v_status is null then raise exception 'CUSTOM_ORDER_NOT_FOUND'; end if;
  if v_token is distinct from p_access_token then raise exception 'INVALID_TOKEN'; end if;
  if v_status <> 'new' then raise exception 'ORDER_ALREADY_STARTED'; end if;

  update custom_orders set status = 'cancelled' where id = p_custom_order_id;
  return (select row_to_json(co) from custom_orders co where co.id = p_custom_order_id);
end;
$$;

grant execute on function cancel_own_custom_order(bigint, uuid) to anon, authenticated;

commit;
