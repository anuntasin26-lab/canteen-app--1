import { defineConfig, devices } from "@playwright/test";

// ทดสอบ flow หลักของหน้าลูกค้าแบบ end-to-end บนเบราว์เซอร์จริง
// ⚠️ ต้องมี dev server รันอยู่ (npm run dev) และ Supabase project ที่มีเมนู
// อย่างน้อย 1 รายการ (available=true) อยู่ในตาราง menu_items ก่อนรัน

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  webServer: process.env.CI ? undefined : {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
