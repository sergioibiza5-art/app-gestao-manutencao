import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/prisma";
loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright");
const base = process.env.PRODUCTION_TEST_URL || "http://localhost:3018";

async function main() {
  const db = getPrisma(), tag = `popup-qa-${randomBytes(4).toString("hex")}`, users: string[] = [];
  let equipmentId = "", batchId = "";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const make = async (suffix: string, role: "SGQ" | "TICKET", flag: boolean) => {
      const u = await db.user.create({ data: { name: `${tag}-${suffix}`, email: "", role, qualityExecutor: flag } }); users.push(u.id); return u;
    };
    const quality = await make("quality", "SGQ", true), denied = await make("denied", "SGQ", false), operator = await make("operator", "TICKET", false);
    equipmentId = (await db.equipment.create({ data: { name: tag, code: tag, category: "QA" } })).id;
    batchId = (await db.productionBatch.create({ data: { reference: tag, lot: tag, equipmentId, createdById: operator.id, status: "OPEN", startedAt: new Date() } })).id;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
    const errors: string[] = []; page.on("pageerror", (e: Error) => errors.push(e.message));
    const pollNow = async (target = page) => target.evaluate(() => window.dispatchEvent(new Event("focus")));
    const signIn = async (id: string) => {
      const token = randomBytes(32).toString("hex");
      await db.session.create({ data: { token, userId: id, expiresAt: new Date(Date.now() + 3600000) } });
      await context.addCookies([{ name: "casa_sgq_session", value: token, url: base }]);
    };
    const endpoint = `${base}/api/producao/quality-requests`;
    assert.equal((await context.request.get(endpoint)).status(), 401);
    for (const user of [denied, operator]) {
      await signIn(user.id);
      assert.equal((await context.request.get(endpoint)).status(), 403);
      await page.goto(`${base}/producao`);
      assert.equal(await page.getByTestId("quality-request-popup").count(), 0);
    }
    await signIn(quality.id);
    const response = await context.request.get(endpoint);
    assert.equal(response.status(), 200);
    assert.ok(response.headers()["cache-control"].includes("no-store"));
    await page.goto(`${base}/producao`);
    await page.waitForResponse((r: { url(): string }) => r.url() === endpoint);
    const popup = page.getByTestId("quality-request-popup");
    if (await popup.count()) await popup.getByRole("button", { name: "Dispensar todos os avisos de CQ" }).click();
    await page.locator('input[name="q"]').focus();
    const createCall = async () => db.productionQualityCall.create({ data: { batchId, calledAt: new Date(), hasStop: true, stopStartedAt: new Date() } });
    const first = await createCall(), second = await createCall(), third = await createCall();
    for (const call of [first, second, third]) await page.getByTestId(`quality-popup-${call.id}`).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("name")), "q");
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await popup.evaluate((el: HTMLElement) => el.scrollWidth > el.clientWidth + 1), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `outputs/quality-popup-${width}.png`, fullPage: true });
    }
    await popup.getByRole("button", { name: "Dispensar todos os avisos de CQ" }).click();
    await popup.waitFor({ state: "detached" });
    const loaded = page.waitForResponse((r: { url(): string }) => r.url() === endpoint);
    await page.reload(); await loaded;
    for (const call of [first, second, third]) assert.equal(await page.getByTestId(`quality-popup-${call.id}`).count(), 0);
    const other = await context.newPage();
    await other.goto(`${base}/funcionario`);
    const fourth = await createCall();
    await other.bringToFront(); await pollNow(other);
    await other.getByTestId(`quality-popup-${fourth.id}`).waitFor();
    await page.bringToFront();
    await page.getByTestId(`quality-popup-${fourth.id}`).waitFor();
    await popup.getByRole("button", { name: "Dispensar todos os avisos de CQ" }).click();
    await other.getByTestId(`quality-popup-${fourth.id}`).waitFor({ state: "detached" });
    const fifth = await createCall();
    await other.bringToFront();
    await pollNow(other);
    await other.getByTestId(`quality-popup-${fifth.id}`).getByRole("link", { name: "Abrir pedido" }).click();
    await other.waitForURL(new RegExp(`lote=${batchId}#cq-${fifth.id}`));
    await page.getByTestId(`quality-popup-${fifth.id}`).waitFor({ state: "detached" });
    const sixth = await createCall();
    await page.bringToFront();
    await pollNow();
    await page.getByTestId(`quality-popup-${sixth.id}`).waitFor();
    await db.productionQualityCall.update({ where: { id: sixth.id }, data: { technicianId: quality.id, arrivedAt: new Date() } });
    await pollNow();
    await page.getByTestId(`quality-popup-${sixth.id}`).waitFor({ state: "detached" });
    assert.equal((await (await context.request.get(endpoint)).json()).calls.some((c: { id: string }) => c.id === sixth.id), false);
    const seventh = await createCall();
    await pollNow();
    await page.getByTestId(`quality-popup-${seventh.id}`).waitFor();
    await db.user.update({ where: { id: quality.id }, data: { qualityExecutor: false } });
    await pollNow();
    await popup.waitFor({ state: "detached" });
    assert.equal((await context.request.get(endpoint)).status(), 403);
    await db.user.update({ where: { id: quality.id }, data: { qualityExecutor: true } });
    await pollNow();
    await page.getByTestId(`quality-popup-${seventh.id}`).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: authorized SGQ-only private feed; automatic popups without stealing focus; desktop/tablet/mobile layout; dismiss persists and syncs tabs; link opens exact CQ; started CQ and revoked permission remove alerts. No emails sent.");
  } finally {
    await browser.close();
    if (batchId) {
      await db.productionQualityCall.deleteMany({ where: { batchId } });
      await db.productionBatch.delete({ where: { id: batchId } });
    }
    if (equipmentId) await db.equipment.delete({ where: { id: equipmentId } });
    await db.session.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
