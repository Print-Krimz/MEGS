import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/login");
  console.log("Page title:", await page.title());
  await browser.close();
  console.log("Playwright browser launched successfully!");
}

run().catch(console.error);
