-- ═══════════════════════════════════════════════════════════
-- Menu Images Setup — รันใน Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1) เพิ่มคอลัมน์ image_url ในตาราง menu_items
alter table menu_items
  add column if not exists image_url text;

-- ═══════════════════════════════════════════════════════════
-- 2) สร้าง Storage bucket (ทำผ่าน Dashboard เท่านั้น ทำผ่าน SQL ไม่ได้)
-- ═══════════════════════════════════════════════════════════
-- ไปที่ Supabase Dashboard → Storage → New bucket
--   ชื่อ bucket: menu-images
--   Public bucket: เปิด (ติ๊กถูก) — เพื่อให้ลูกค้าดูรูปได้โดยไม่ต้อง login
--   File size limit: 5 MB
--   Allowed MIME types: image/*
--
-- จากนั้นรัน policy ด้านล่างนี้ต่อ (ให้ทุกคนอ่านได้, เขียนได้เฉพาะผ่าน service
-- หรือถ้ายังไม่มีระบบ auth แยกครัว ให้เปิด insert/update/delete แบบ public ไปก่อน
-- แล้วค่อยจำกัดสิทธิ์เมื่อทำระบบ auth ของครัวเสร็จ)

-- อ่านรูปได้ทุกคน (public read)
create policy "menu images public read"
on storage.objects for select
using (bucket_id = 'menu-images');

-- อัปโหลด/แก้ไข/ลบได้ทุกคน (ชั่วคราว — ควรจำกัดสิทธิ์ทีหลังด้วย auth จริง)
create policy "menu images public insert"
on storage.objects for insert
with check (bucket_id = 'menu-images');

create policy "menu images public update"
on storage.objects for update
using (bucket_id = 'menu-images');

create policy "menu images public delete"
on storage.objects for delete
using (bucket_id = 'menu-images');
