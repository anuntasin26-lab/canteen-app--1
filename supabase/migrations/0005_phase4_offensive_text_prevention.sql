-- Phase 4: ป้องกันคำหยาบ/ชื่อไม่เหมาะสม (3 ชั้น: normalize → blacklist → reporting)
-- รันหลัง 0001-0004 บน dev/staging project ก่อนเสมอ

begin;

-- ── Layer 1: normalize_text() ────────────────────────────
-- unicode NFKC + ตัด zero-width + ยุบตัวอักษรซ้ำ + map homoglyph/leetspeak
-- ที่พบบ่อย + ตัดช่องว่าง/สัญลักษณ์/อักขระนอก allowlist (a-z, 0-9, ไทย) ทิ้งหมด
-- หมายเหตุ: allowlist-only ท้ายสุดทำให้อักขระแปลกปลอมที่ map ไม่ครบ (เช่น script
-- อื่นที่ไม่ได้ระบุไว้) ถูกตัดทิ้งไปเลย แทนที่จะคงค้างและหลบเลี่ยงการเทียบคำได้
create or replace function normalize_text(input text) returns text
language sql immutable
as $$
  select regexp_replace(
    translate(
      regexp_replace(
        regexp_replace(
          lower(normalize(coalesce(input, ''), NFKC)),
          '[\u200B\u200C\u200D\u2060\uFEFF]', '', 'g'
        ),
        '(.)\1+', '\1', 'g'
      ),
      'аеорсух013457$@',
      'aeopcyxoieastsa'
    ),
    '[^a-z0-9ก-๙]', '', 'g'
  );
$$;

-- ── Layer 2: blacklist_words ──────────────────────────────
-- เก็บเป็นรูป normalize แล้วเสมอ (ผ่าน trigger) — admin พิมพ์แบบไหนก็ได้จากหน้า /admin
create table blacklist_words (
  id bigserial primary key,
  word text not null unique,
  created_at timestamptz not null default now()
);

create or replace function normalize_blacklist_word() returns trigger as $$
begin
  new.word := normalize_text(new.word);
  if new.word = '' then
    raise exception 'EMPTY_WORD_AFTER_NORMALIZE';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_normalize_blacklist_word
  before insert or update on blacklist_words
  for each row execute function normalize_blacklist_word();

alter table blacklist_words enable row level security;
create policy "blacklist_staff_all" on blacklist_words for all to authenticated using (true) with check (true);
-- anon ไม่มีสิทธิ์เข้าถึงตารางนี้เลย (ทั้ง select/insert) — เช็คผ่าน RPC เท่านั้น

create or replace function contains_blacklisted_word(input text) returns boolean
language sql stable
as $$
  select exists (
    select 1 from blacklist_words b
    where b.word <> '' and normalize_text(input) like '%' || b.word || '%'
  );
$$;

-- ── Layer 3: flagged_names (reporting โดยครัว) ────────────
create table flagged_names (
  id bigserial primary key,
  order_id bigint references orders(id) on delete set null,
  custom_order_id bigint references custom_orders(id) on delete set null,
  flagged_text text not null,
  flagged_by uuid references staff(id),
  created_at timestamptz not null default now(),
  reviewed boolean not null default false
);

alter table flagged_names enable row level security;
create policy "flagged_names_staff_all" on flagged_names for all to authenticated using (true) with check (true);

-- ── เติม blacklist check เข้า RPC เดิม ────────────────────
-- soft-block: raise exception 'OFFENSIVE_NAME' — ฝั่ง client จับ error code นี้
-- แล้วขึ้น warning ให้แก้ชื่อก่อน ไม่ใช่ hard reject เงียบ ๆ

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
  if p_extra_note is not null and contains_blacklisted_word(p_extra_note) then
    raise exception 'OFFENSIVE_NAME';
  end if;

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
        and o.id <> p_order_id;

      if v_sold_today + v_qty > v_menu.daily_limit then
        raise exception 'SOLD_OUT:%', v_menu.name;
      end if;
    end if;

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
  if contains_blacklisted_word(p_new_name) then
    raise exception 'OFFENSIVE_NAME';
  end if;

  select status, access_token into v_status, v_token from orders where id = p_order_id for update;
  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_token is distinct from p_access_token then raise exception 'INVALID_TOKEN'; end if;

  update orders set customer_name = trim(p_new_name) where id = p_order_id;
  return (select row_to_json(ow) from orders_with_items ow where ow.id = p_order_id);
end;
$$;

-- ── RPC: create_custom_order (แทนที่ INSERT ตรงจาก client) ─
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

grant execute on function create_custom_order(text, text, text) to anon, authenticated;

-- ปิดการ insert ตรงจาก client บน custom_orders (ต้องผ่าน RPC เท่านั้นแล้ว)
drop policy if exists "custom_orders_anon_insert" on custom_orders;

commit;
