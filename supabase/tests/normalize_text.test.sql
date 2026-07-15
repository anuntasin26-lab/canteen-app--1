-- supabase/tests/normalize_text.test.sql
-- pgTAP tests สำหรับ normalize_text() (Layer 1 ของระบบป้องกันคำหยาบ)
--
-- รันด้วย Supabase CLI (ต้องมี pgTAP extension และเชื่อมกับ local/dev DB
-- ที่รัน migration 0005 แล้ว): 
--   supabase test db
--
-- หมายเหตุ: ไฟล์นี้เขียนไว้ให้พร้อมรัน แต่ยังไม่เคยรันจริงในเครื่องมือของผม
-- (sandbox นี้ไม่มี Postgres/pgTAP/เชื่อม Supabase ได้) กรุณารันด้วยตัวเองอีกที
-- ก่อนเชื่อว่าผ่านจริง — ดูรายละเอียดใน delivery notes

begin;
select plan(9);

select is(normalize_text('Hello'), 'hello', 'แปลงเป็นตัวพิมพ์เล็ก');
select is(normalize_text('b' || chr(8203) || 'a' || chr(8203) || 'd'), 'bad', 'ตัด zero-width character ออก');
select is(normalize_text('baaaad'), 'bad', 'ยุบตัวอักษรซ้ำติดกันเหลือตัวเดียว');
select is(normalize_text('b4d'), 'bad', 'แปลง leetspeak (4 -> a)');
select is(normalize_text('bаd'), 'bad', 'แปลง cyrillic homoglyph (а -> a)');
select is(normalize_text('b a d'), 'bad', 'ตัดช่องว่างที่แทรกกลางคำ');
select is(normalize_text('สวัสดี'), 'สวัสดี', 'คงข้อความภาษาไทยไว้ตามเดิม');
select is(normalize_text(''), '', 'string ว่าง ให้ผลเป็น string ว่าง');
select is(normalize_text(null), '', 'null coalesce เป็น string ว่าง ไม่ error');

select * from finish();
rollback;
