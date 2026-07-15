-- Phase 0: เลิกใช้ multi-department
-- รันไฟล์นี้ผ่าน Supabase Dashboard → SQL Editor (หรือ `supabase db push` ถ้าตั้ง CLI แล้ว)
-- ⚠️ ตรวจสอบก่อนรันจริงว่าอยู่ใน Supabase project ที่ถูกต้อง (แนะนำ: สร้าง dev/staging
--    project แยกจาก production ตามที่ตกลงไว้ใน roadmap ก่อนรันไฟล์นี้)

begin;

-- ตัด FK ที่ผูกกับ departments ออกจากตารางที่ยังอ้างอิงอยู่
alter table if exists orders        drop column if exists dept_id;
alter table if exists custom_orders drop column if exists dept_id;

-- ลบตาราง departments ทิ้งทั้งหมด (ไม่ใช้ multi-department แล้ว)
drop table if exists departments;

commit;
