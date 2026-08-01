# โรงอาหาร (Canteen App)

ระบบสั่งอาหารโรงอาหาร สร้างด้วย [Next.js](https://nextjs.org) และ [Supabase](https://supabase.com)

## เริ่มต้นใช้งาน

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า environment variables

คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่าให้ครบ:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — จาก Supabase Dashboard → Settings → API
- `NEXT_PUBLIC_KITCHEN_PIN` — PIN เข้าหน้าครัว/เมนูย้อนหลัง (ชั่วคราว จะย้ายไปตรวจสอบฝั่ง server ใน Phase 1)

### 3. รัน development server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) เพื่อดูผลลัพธ์

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `npm run dev` | รัน dev server |
| `npm run build` | build สำหรับ production |
| `npm run start` | รัน production server |
| `npm run lint` | ตรวจสอบ code style ด้วย ESLint |
| `npm test` | รัน unit test ด้วย [Vitest](https://vitest.dev) |
| `npm run test:e2e` | รัน end-to-end test ด้วย [Playwright](https://playwright.dev) |

## โครงสร้างโปรเจกต์

- `app/` — หน้าเว็บและ route ต่าง ๆ (App Router)
  - `app/order/` — flow การสั่งอาหารของลูกค้า
  - `app/kitchen/` — หน้าจัดการออเดอร์ฝั่งครัว
  - `app/admin/` — หน้าจัดการเมนู/ระบบฝั่งแอดมิน
  - `app/menu-history/` — ประวัติเมนูย้อนหลัง
- `lib/` — ฟังก์ชันช่วยเหลือแบบ pure function (เช่น `cart-utils.ts`) และการเชื่อมต่อ Supabase
- `supabase/` — migration และ test ฝั่งฐานข้อมูล
- `e2e/` — end-to-end test ด้วย Playwright
