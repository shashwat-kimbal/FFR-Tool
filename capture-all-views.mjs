import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const DIR = path.join(process.cwd(), "screenshots", "current");

if (!fs.existsSync(DIR)) {
  fs.mkdirSync(DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch();
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.error("BROWSER PAGE ERROR:", err.message));

  console.log("Navigating to /queue...");
  await page.goto(`${BASE_URL}/queue`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(DIR, "queue-1280-debug.png") });

  await browser.close();
}

capture();
