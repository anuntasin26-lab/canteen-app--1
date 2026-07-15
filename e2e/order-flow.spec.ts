import { test, expect } from "@playwright/test";

// ⚠️ ยังไม่เคยรันจริงในเครื่องมือของผม (sandbox นี้ไม่มีเบราว์เซอร์/เชื่อม
// Supabase จริงได้) เขียนไว้ให้ครบตาม flow หลัก — รันเองอีกทีก่อนเชื่อว่าผ่านจริง
// ด้วย: npx playwright test (ต้องมี dev server + Supabase ที่มีเมนูอย่างน้อย 1 รายการ)

test.describe("Order flow หลักของลูกค้า", () => {
  test.beforeEach(async ({ page }) => {
    // เริ่มทุกเทสจากหน้าใหม่ ไม่มีชื่อ/ออเดอร์ค้างใน localStorage
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/order");
  });

  test("กรอกชื่อ -> เลือกเมนู -> ยืนยันออเดอร์ -> เห็นหน้าสถานะ", async ({ page }) => {
    // หน้าแรกควร redirect มาที่ /order/name เพราะยังไม่มีชื่อ
    await expect(page).toHaveURL(/\/order\/name/);

    await page.getByPlaceholder(/เช่น สมชาย/).fill("ทดสอบ E2E");
    await page.getByRole("button", { name: /ดูเมนู/ }).click();
    await expect(page).toHaveURL(/\/order\/menu/);

    // เพิ่มเมนูแรกที่เจอ 1 ชิ้น (ปุ่ม + วงกลมสีเขียว)
    const firstAddButton = page.getByRole("button", { name: /^เพิ่ม / }).first();
    await expect(firstAddButton).toBeVisible({ timeout: 10_000 });
    await firstAddButton.click();

    await page.getByText("ดูตะกร้า").click();
    await expect(page).toHaveURL(/\/order\/cart/);

    await page.getByRole("button", { name: "ยืนยันการสั่งอาหาร" }).click();
    await expect(page).toHaveURL(/\/order\/status/, { timeout: 10_000 });
    await expect(page.getByText("ออร์เดอร์ถูกส่งแล้ว")).toBeVisible();
  });

  test("เมนูที่ปิดขายหรือเต็มโควตาต้องไม่แสดงในรายการ", async ({ page }) => {
    await page.getByPlaceholder(/เช่น สมชาย/).fill("ทดสอบ E2E");
    await page.getByRole("button", { name: /ดูเมนู/ }).click();
    await expect(page).toHaveURL(/\/order\/menu/);

    // ทดสอบนี้ต้อง setup ข้อมูลล่วงหน้า (เมนูที่ available=false หรือ
    // daily_limit เต็มแล้ว) ถึงจะยืนยันได้จริงว่าไม่โผล่ในรายการ — เขียนไว้เป็น
    // โครง ให้เติม assertion ตามชื่อเมนูที่ seed ไว้จริงในโปรเจกต์คุณ
    // ตัวอย่าง: await expect(page.getByText("เมนูที่ปิดขายไว้ทดสอบ")).not.toBeVisible();
  });

  test("กด back ของเบราว์เซอร์ต้องย้อนกลับใน flow ได้จริง ไม่หลุดออกแอป", async ({ page }) => {
    await page.getByPlaceholder(/เช่น สมชาย/).fill("ทดสอบ back button");
    await page.getByRole("button", { name: /ดูเมนู/ }).click();
    await expect(page).toHaveURL(/\/order\/menu/);

    await page.goBack();
    await expect(page).toHaveURL(/\/order\/name/);
  });
});
