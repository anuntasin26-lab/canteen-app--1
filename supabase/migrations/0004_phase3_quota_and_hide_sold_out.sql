-- Phase 3: จำกัดจำนวนเมนู/วัน + ซ่อนเมนูที่ปิดขาย/เต็มโควตาอัตโนมัติ
-- รันหลัง 0001, 0002, 0003 บน dev/staging project ก่อนเสมอ

begin;

-- ── daily_limit ──────────────────────────────────────────
-- null = ไม่จำกัด (พฤติกรรมเดิม) ครัวตั้งเองต่อเมนู/วันในแท็บเมนู
alter table menu_items add column if not exists daily_limit int check (daily_limit is null or daily_limit > 0);

-- ── view: menu_items_with_remaining ──────────────────────
-- คำนวณยอดคงเหลือวันนี้แบบสด จากยอดสั่งจริงใน order_items (ไม่นับออเดอร์ที่ถูกยกเลิก)
-- ไม่มี state ที่ต้อง reset รายวัน — ใช้ date_trunc('day', now()) กรองเสมอ จึงไม่มีวันค้าง
create or replace view menu_items_with_remaining
  with (security_invoker = true) as
select
  m.*,
  case
    when m.daily_limit is null then null
    else greatest(m.daily_limit - coalesce(sold.qty_today, 0), 0)
  end as remaining_today
from menu_items m
left join (
  select oi.menu_item_id, sum(oi.qty) as qty_today
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.created_at >= date_trunc('day', now())
    and o.status <> 'cancelled'
  group by oi.menu_item_id
) sold on sold.menu_item_id = m.id;

grant select on menu_items_with_remaining to anon, authenticated;

-- ── เติม quota check เข้า RPC เดิม (create_order / add_items_to_order) ───
-- ใช้ "select ... for update" ล็อกแถว menu_items ระหว่างเช็ค+insert เพื่อกัน
-- race condition ตอนมีคนสั่งเมนูเดียวกันพร้อมกันหลายคน (ปิดช่องขายเกินจริง)

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
  v_sold_today numeric;
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

    -- for update: ล็อกแถวเมนูนี้จนจบธุรกรรม กันสองออเดอร์เช็ค/ตัดโควตาพร้อมกัน
    select id, name, price, available, daily_limit into v_menu
    from menu_items where id = (v_item ->> 'id')::bigint
    for update;

    if v_menu.id is null then
      raise exception 'MENU_ITEM_NOT_FOUND';
    end if;
    if not v_menu.available then
      raise exception 'MENU_ITEM_UNAVAILABLE:%', v_menu.name;
    end if;

    if v_menu.daily_limit is not null then
      select coalesce(sum(oi.qty), 0) into v_sold_today
      from order_items oi
      join orders o on o.id = oi.order_id
      where oi.menu_item_id = v_menu.id
        and o.created_at >= date_trunc('day', now())
        and o.status <> 'cancelled';

      if v_sold_today + v_qty > v_menu.daily_limit then
        raise exception 'SOLD_OUT:%', v_menu.name;
      end if;
    end if;

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
  v_sold_today numeric;
begin
  select status, access_token into v_status, v_token
  from orders where id = p_order_id
  for update;

  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_token is distinct from p_access_token then raise exception 'INVALID_TOKEN'; end if;
  if v_status <> 'new' then raise exception 'ORDER_ALREADY_STARTED'; end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'INVALID_QTY'; end if;

    select id, name, price, available, daily_limit into v_menu
    from menu_items where id = (v_item ->> 'id')::bigint
    for update;

    if v_menu.id is null then raise exception 'MENU_ITEM_NOT_FOUND'; end if;
    if not v_menu.available then raise exception 'MENU_ITEM_UNAVAILABLE:%', v_menu.name; end if;

    if v_menu.daily_limit is not null then
      select coalesce(sum(oi.qty), 0) into v_sold_today
      from order_items oi
      join orders o on o.id = oi.order_id
      where oi.menu_item_id = v_menu.id
        and o.created_at >= date_trunc('day', now())
        and o.status <> 'cancelled'
        and o.id <> p_order_id; -- ไม่นับของออเดอร์นี้เองซ้ำ (มันจะถูกบวกเพิ่มด้านล่าง)

      if v_sold_today + v_qty > v_menu.daily_limit then
        raise exception 'SOLD_OUT:%', v_menu.name;
      end if;
    end if;

    -- [Phase 4: เพิ่ม blacklist check ของ p_extra_note ตรงนี้]

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

commit;
