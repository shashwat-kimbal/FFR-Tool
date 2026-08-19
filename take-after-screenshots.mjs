import { chromium } from "playwright";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join(process.cwd(), "screenshots", "after");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 404) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not respond within ${timeout}ms`);
}

async function main() {
  console.log("Starting dev server for after screenshots...");
  const devProcess = spawn("npx", ["vinext", "dev"], {
    stdio: "inherit",
    shell: true,
  });

  try {
    await waitForServer(BASE_URL);
    console.log("Dev server is ready. Launching browser...");

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    const routes = [
      { name: "01-cases-list", url: "/" },
      { name: "02-rules-library", url: "/rules" },
      { name: "03-governance", url: "/governance" },
      { name: "04-settings", url: "/settings" },
    ];

    for (const route of routes) {
      console.log(`Navigating to ${route.url}...`);
      await page.goto(`${BASE_URL}${route.url}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000); // let UI settle
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${route.name}.png`),
        fullPage: true,
      });
      console.log(`Saved screenshot ${route.name}.png`);
    }

    // Try navigating to a case detail page if available
    console.log("Checking for case pages...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const caseLinks = await page.$$eval("a[href*='/cases/']", (els) =>
      els.map((e) => e.getAttribute("href"))
    );
    if (caseLinks.length > 0) {
      console.log(`Navigating to case detail: ${caseLinks[0]}...`);
      await page.goto(`${BASE_URL}${caseLinks[0]}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-case-detail.png"),
        fullPage: true,
      });
      console.log("Saved screenshot 05-case-detail.png");
    }

    await browser.close();
    console.log("All AFTER screenshots captured!");
  } finally {
    devProcess.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
