-- Phase 6: Security Hardening & Observability
-- - audit log (ใครแก้/ยกเลิก/ลบออเดอร์ — ครอบคลุมทั้งทาง RPC และทาง staff
--   เพราะ auth.uid() อ่านจาก JWT ของผู้เรียกจริงเสมอ ไม่ถูกเปลี่ยนโดย SECURITY DEFINER)
-- - rate limit การสร้างออเดอร์ต่อ IP (ทำใน Postgres เพราะ client เรียก Supabase
--   ตรงจาก browser ไม่ผ่าน Next.js server เลย — Vercel Edge Middleware จึงมองไม่เห็น
--   คำขอเหล่านี้ ต้องกันที่ฝั่ง DB/RPC แทน)
--
-- รันหลัง 0001-0005 บน dev/staging project ก่อนเสมอ

begin;

-- ── audit_log ────────────────────────────────────────────
create table audit_log (
  id bigserial primary key,
  actor_id uuid,                -- null = ลูกค้า (ไม่มี auth), มีค่า = staff คนที่ทำรายการ
  action text not null,         -- 'status_change' | 'rename' | 'delete'
  target_type text not null,    -- ชื่อตาราง ('orders' | 'custom_orders')
  target_id bigint,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;
create policy "audit_log_staff_select" on audit_log for select to authenticated using (true);
-- ไม่มี insert policy ให้ client เลยทั้ง anon/authenticated — insert เกิดจาก
-- trigger function (security definer) เท่านั้น ปลอมแปลง log เองไม่ได้

create or replace function log_order_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into audit_log (actor_id, action, target_type, target_id, detail)
      values (auth.uid(), 'status_change', TG_TABLE_NAME, new.id,
              jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if TG_TABLE_NAME = 'orders' and old.customer_name is distinct from new.customer_name then
      insert into audit_log (actor_id, action, target_type, target_id, detail)
      values (auth.uid(), 'rename', TG_TABLE_NAME, new.id,
              jsonb_build_object('from', old.customer_name, 'to', new.customer_name));
    end if;
  elsif TG_OP = 'DELETE' then
    insert into audit_log (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), 'delete', TG_TABLE_NAME, old.id,
            jsonb_build_object('customer_name', old.customer_name, 'status', old.status));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_orders
  after update or delete on orders
  for each row execute function log_order_change();

create trigger trg_audit_custom_orders
  after update or delete on custom_orders
  for each row execute function log_order_change();

-- ── Rate limiting การสร้างออเดอร์ ─────────────────────────
create table rate_limit_log (
  id bigserial primary key,
  ip text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index idx_rate_limit_lookup on rate_limit_log (ip, action, created_at);

-- ลบ log เก่ากว่า 1 ชม.ทิ้งเรื่อย ๆ กันตารางบวม (เรียกท้าย check_rate_limit ทุกครั้ง)
create or replace function check_rate_limit(p_action text, p_max_per_minute int default 10) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
  v_count int;
begin
  v_ip := coalesce(
    current_setting('request.headers', true)::json ->> 'x-forwarded-for',
    'unknown'
  );

  select count(*) into v_count
  from rate_limit_log
  where ip = v_ip and action = p_action and created_at > now() - interval '1 minute';

  if v_count >= p_max_per_minute then
    raise exception 'RATE_LIMITED';
  end if;

  insert into rate_limit_log (ip, action) values (v_ip, p_action);
  delete from rate_limit_log where created_at < now() - interval '1 hour';
end;
$$;

-- เติมเรียก check_rate_limit เข้า RPC ที่ลูกค้าเรียกได้เอง (สร้างออเดอร์)
-- 10 ครั้ง/นาที/IP ต่อ action — เพียงพอสำหรับการสั่งอาหารจริง กันสแปมออเดอร์ปลอมจำนวนมาก

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
  perform check_rate_limit('create_order', 10);

  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  if contains_blacklisted_word(p_customer_name) or contains_blacklisted_word(coalesce(p_note, '')) then
    raise exception 'OFFENSIVE_NAME';
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

    insert into order_items (order_id, menu_item_id, name, price, qty)
    values (v_order_id, v_menu.id, v_menu.name, v_menu.price, v_qty)
    on conflict (order_id, menu_item_id) do update set qty = order_items.qty + excluded.qty;

    v_total := v_total + (v_menu.price * v_qty);
  end loop;

  update orders set total = v_total where id = v_order_id;

  return (select row_to_json(ow) from orders_with_items ow where ow.id = v_order_id);
end;
$$;

create or replace function create_custom_order(
  p_customer_name text,
  p_items text,
  p_note text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row custom_orders;
begin
  perform check_rate_limit('create_custom_order', 10);

  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;
  if p_items is null or length(trim(p_items)) = 0 then
    raise exception 'EMPTY_ITEMS';
  end if;
  if contains_blacklisted_word(p_customer_name)
     or contains_blacklisted_word(p_items)
     or contains_blacklisted_word(coalesce(p_note, '')) then
    raise exception 'OFFENSIVE_NAME';
  end if;

  insert into custom_orders (customer_name, items, note, status)
  values (trim(p_customer_name), trim(p_items), nullif(trim(coalesce(p_note, '')), ''), 'new')
  returning * into v_row;

  return row_to_json(v_row);
end;
$$;

commit;
