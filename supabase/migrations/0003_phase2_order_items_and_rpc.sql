-- Phase 2: Server-side business logic layer
-- - normalize orders.items (JSON) → order_items (relational)
-- - เพิ่ม constraints ที่ DB ระดับ (price>0, status enum)
-- - สร้าง RPC atomic สำหรับสร้าง/เพิ่มรายการออเดอร์ (คำนวณราคาจริงฝั่ง server เสมอ)
-- - ปิดการ insert/update ตรงจาก client บน orders/order_items ผ่าน RLS
--   (บังคับผ่าน RPC เท่านั้น — RPC ใช้ SECURITY DEFINER เพื่อ bypass RLS อย่างมีการควบคุม)
--
-- รันหลัง 0001, 0002 บน dev/staging project ก่อนเสมอ
-- ⚠️ ไม่มีข้อมูลจริงในระบบตอนนี้ (ยืนยันจากบทสนทนา) จึงลบคอลัมน์ items (JSON) ทิ้งได้เลย
--    โดยไม่ต้อง migrate ข้อมูลเก่า — ถ้ามีข้อมูลจริงแล้วตอนรัน ต้อง backfill ก่อน drop column

begin;

-- ── order_items ──────────────────────────────────────────
create table if not exists order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  menu_item_id bigint references menu_items(id),
  name text not null,          -- snapshot ชื่อเมนู ณ เวลาสั่ง (กันปัญหาถ้าเมนูถูกลบ/เปลี่ยนชื่อทีหลัง)
  price numeric not null check (price > 0),  -- snapshot ราคา ณ เวลาสั่ง
  qty int not null check (qty > 0),
  unique (order_id, menu_item_id)  -- 1 เมนูต่อ 1 ออเดอร์ = 1 แถว (รวม qty แทนการซ้ำแถว)
);

alter table order_items enable row level security;
-- อ่านเปิดกว้างเท่ากับ orders (anon อ่านได้เพื่อแสดงผล, staff อ่านได้)
create policy "order_items_anon_select"  on order_items for select to anon using (true);
create policy "order_items_staff_select" on order_items for select to authenticated using (true);
-- ไม่มี insert/update/delete policy ให้ anon/authenticated เลย
-- โดยตั้งใจ — เขียนได้ทางเดียวคือผ่าน RPC (SECURITY DEFINER) เท่านั้น

-- ── ตัด orders.items (JSON) ทิ้ง — ย้ายไป order_items แล้ว ──
alter table orders drop column if exists items;

-- ── DB-level constraints ─────────────────────────────────
alter table menu_items add constraint menu_items_price_positive check (price > 0);

alter table orders add constraint orders_status_valid
  check (status in ('new','cooking','done','cancelled'));
alter table custom_orders add constraint custom_orders_status_valid
  check (status in ('new','cooking','done','cancelled'));

-- ปิดไม่ให้ client insert/update ตรงบน orders อีกต่อไป (ต้องผ่าน RPC เท่านั้น)
drop policy if exists "orders_anon_insert" on orders;
drop policy if exists "orders_anon_update_own" on orders;

-- ── view: orders_with_items ──────────────────────────────
-- รวม order_items กลับเป็น JSON array ให้ frontend เดิมใช้ shape เดิมได้ (ไม่ต้อง
-- รื้อ Order type/การแสดงผลทั้งแอป) — security_invoker=true ทำให้ RLS ของ
-- orders/order_items ยังบังคับใช้ตามสิทธิ์ผู้เรียก ไม่ใช่ของเจ้าของ view
create or replace view orders_with_items
  with (security_invoker = true) as
select
  o.id, o.customer_name, o.note, o.total, o.status,
  o.created_at, o.started_at, o.completed_at, o.access_token,
  coalesce(
    (select json_agg(
        json_build_object('id', oi.menu_item_id, 'name', oi.name, 'price', oi.price, 'qty', oi.qty)
        order by oi.id
      )
     from order_items oi where oi.order_id = o.id),
    '[]'::json
  ) as items
from orders o;

grant select on orders_with_items to anon, authenticated;

-- ── RPC: create_order ────────────────────────────────────
-- สร้างออเดอร์แบบ atomic: ราคาคำนวณจาก menu_items จริงเสมอ (ไม่เชื่อราคาจาก client)
-- p_items shape: [{"id": 1, "qty": 2}, ...]
create or replace function create_order(
  p_customer_name text,
  p_items jsonb,
  p_note text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_total numeric := 0;
  v_item jsonb;
  v_menu record;
  v_qty int;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  insert into orders (customer_name, note, total, status)
  values (trim(p_customer_name), nullif(trim(coalesce(p_note, '')), ''), 0, 'new')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'qty')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QTY';
    end if;

    select id, name, price, available into v_menu
    from menu_items where id = (v_item ->> 'id')::bigint;

    if v_menu.id is null then
      raise exception 'MENU_ITEM_NOT_FOUND';
    end if;
    if not v_menu.available then
      raise exception 'MENU_ITEM_UNAVAILABLE:%', v_menu.name;
    end if;

    -- [Phase 3: เพิ่ม quota check ตรงนี้ — เช็คยอดสั่งวันนี้ของ v_menu.id เทียบ daily_limit]
    -- [Phase 4: เพิ่ม blacklist check ของ p_customer_name/p_note ตรงนี้ (normalize ก่อนเทียบ)]

    insert into order_items (order_id, menu_item_id, name, price, qty)
    values (v_order_id, v_menu.id, v_menu.name, v_menu.price, v_qty)
    on conflict (order_id, menu_item_id) do update set qty = order_items.qty + excluded.qty;

    v_total := v_total + (v_menu.price * v_qty);
  end loop;

  update orders set total = v_total where id = v_order_id;

  return (select row_to_json(ow) from orders_with_items ow where ow.id = v_order_id);
end;
$$;

grant execute on function create_order(text, jsonb, text) to anon, authenticated;

-- ── RPC: add_items_to_order (สั่งเพิ่ม) ──────────────────
create or replace function add_items_to_order(
  p_order_id bigint,
  p_access_token uuid,
  p_items jsonb,
  p_extra_note text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_token uuid;
  v_qty int;
  v_menu record;
  v_item jsonb;
  v_total numeric;
begin
  select status, access_token into v_status, v_token
  from orders where id = p_order_id
  for update;  -- lock แถวกันแก้พร้อมกัน

  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_token is distinct from p_access_token then raise exception 'INVALID_TOKEN'; end if;
  if v_status <> 'new' then raise exception 'ORDER_ALREADY_STARTED'; end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'INVALID_QTY'; end if;

    select id, name, price, available into v_menu
    from menu_items where id = (v_item ->> 'id')::bigint;

    if v_menu.id is null then raise exception 'MENU_ITEM_NOT_FOUND'; end if;
    if not v_menu.available then raise exception 'MENU_ITEM_UNAVAILABLE:%', v_menu.name; end if;

    -- [Phase 3: เพิ่ม quota check ตรงนี้เหมือนกับใน create_order]

    insert into order_items (order_id, menu_item_id, name, price, qty)
    values (p_order_id, v_menu.id, v_menu.name, v_menu.price, v_qty)
    on conflict (order_id, menu_item_id) do update set qty = order_items.qty + excluded.qty;
  end loop;

  if p_extra_note is not null and length(trim(p_extra_note)) > 0 then
    update orders
    set note = nullif(trim(coalesce(note || ' / ', '') || p_extra_note), '')
    where id = p_order_id;
  end if;

  select coalesce(sum(price * qty), 0) into v_total from order_items where order_id = p_order_id;
  update orders set total = v_total where id = p_order_id;

  return (select row_to_json(ow) from orders_with_items ow where ow.id = p_order_id);
end;
$$;

grant execute on function add_items_to_order(bigint, uuid, jsonb, text) to anon, authenticated;

-- ── RPC: rename_own_order / cancel_own_order ─────────────
-- แทนที่ policy "orders_anon_update_own" เดิม (ถูก drop ไปด้านบน) ด้วย RPC
-- ที่ชัดเจนกว่า — ตรวจ access_token ผ่าน parameter ตรง ๆ ไม่ต้องพึ่ง custom header
create or replace function rename_own_order(
  p_order_id bigint,
  p_access_token uuid,
  p_new_name text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_token uuid;
begin
  if p_new_name is null or length(trim(p_new_name)) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;

  select status, access_token into v_status, v_token from orders where id = p_order_id for update;
  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_token is distinct from p_access_token then raise exception 'INVALID_TOKEN'; end if;

  update orders set customer_name = trim(p_new_name) where id = p_order_id;
  return (select row_to_json(ow) from orders_with_items ow where ow.id = p_order_id);
end;
$$;

grant execute on function rename_own_order(bigint, uuid, text) to anon, authenticated;

create or replace function cancel_own_order(
  p_order_id bigint,
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
  select status, access_token into v_status, v_token from orders where id = p_order_id for update;
  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_token is distinct from p_access_token then raise exception 'INVALID_TOKEN'; end if;
  if v_status <> 'new' then raise exception 'ORDER_ALREADY_STARTED'; end if;

  update orders set status = 'cancelled' where id = p_order_id;
  return (select row_to_json(ow) from orders_with_items ow where ow.id = p_order_id);
end;
$$;

grant execute on function cancel_own_order(bigint, uuid) to anon, authenticated;

commit;
