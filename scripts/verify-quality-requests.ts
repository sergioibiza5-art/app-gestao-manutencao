import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/prisma";
import { notifyQualityCall } from "@/lib/production-quality-email";
loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright");
const base = process.env.PRODUCTION_TEST_URL || "http://localhost:3015";

async function main() {
  const db = getPrisma(), tag = `cq-qa-${randomBytes(4).toString("hex")}`, ids: string[] = [];
  let equipmentId = "", batchId = "", callId = "";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const make = async (suffix: string, role: "ADMIN" | "SGQ" | "USER", qualityExecutor = false, active = true) => {
      const u = await db.user.create({ data: { name: `${tag}-${suffix}`, email: `${tag}-${suffix}@example.invalid`, role, qualityExecutor, active } }); ids.push(u.id); return u;
    };
    const admin = await make("admin", "ADMIN"), quality = await make("quality", "SGQ"), denied = await make("denied", "SGQ"), inactive = await make("inactive", "SGQ", true, false), wrongRole = await make("wrong", "USER", true);
    equipmentId = (await db.equipment.create({ data: { name: tag, code: tag, category: "QA" } })).id;
    batchId = (await db.productionBatch.create({ data: { reference: tag, lot: tag, equipmentId, createdById: admin.id, status: "OPEN", startedAt: new Date() } })).id;
    callId = (await db.productionQualityCall.create({ data: { batchId, calledAt: new Date(), hasStop: true, stopStartedAt: new Date() } })).id;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
    const errors: string[] = []; page.on("pageerror", (e: Error) => errors.push(e.message));
    const setUser = async (id: string) => {
      const token = randomBytes(32).toString("hex");
      await db.session.create({ data: { token, userId: id, expiresAt: new Date(Date.now() + 3600000) } });
      await context.addCookies([{ name: "casa_sgq_session", value: token, url: base }]);
    };
    await setUser(admin.id);
    await page.goto(`${base}/acessos`);
    const form = page.locator("form").filter({ has: page.locator(`input[name="id"][value="${quality.id}"]`) }).first();
    await form.getByLabel("Pode executar controlo de qualidade", { exact: true }).check();
    await form.getByRole("button", { name: "Atualizar", exact: true }).click();
    await page.waitForTimeout(500);
    await page.reload();
    assert.equal(await form.getByLabel("Pode executar controlo de qualidade", { exact: true }).isChecked(), true);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: quality.id } })).qualityExecutor, true);
    const delivered: string[] = [];
    const fakeSend = async (to: string) => { delivered.push(to); };
    await notifyQualityCall(callId, fakeSend);
    assert.ok(delivered.includes(quality.email));
    for (const u of [admin, denied, inactive, wrongRole]) assert.equal(delivered.includes(u.email), false);
    const count = delivered.length;
    await notifyQualityCall(callId, fakeSend);
    assert.equal(delivered.length, count);
    await db.alertDigestDelivery.deleteMany({ where: { userId: quality.id, channel: "production-quality-call", digestDate: callId } });
    const failed = await notifyQualityCall(callId, async (to: string) => { if (to === quality.email) throw new Error("Simulated SMTP failure"); });
    assert.ok(failed.failed >= 1);
    assert.equal(await db.alertDigestDelivery.count({ where: { userId: quality.id, channel: "production-quality-call", digestDate: callId } }), 0);
    await notifyQualityCall(callId, fakeSend);
    assert.equal(await db.alertDigestDelivery.count({ where: { userId: quality.id, channel: "production-quality-call", digestDate: callId } }), 1);
    await setUser(denied.id);
    await page.goto(`${base}/producao`);
    const request = page.getByTestId(`quality-request-${callId}`);
    await request.getByRole("link", { name: "Abrir pedido" }).click();
    assert.equal(await page.getByRole("button", { name: "Iniciar CQ", exact: true }).count(), 0);
    assert.equal((await db.productionQualityCall.findUniqueOrThrow({ where: { id: callId } })).arrivedAt, null);
    await setUser(quality.id);
    await page.goto(`${base}/producao`);
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByTestId(`quality-request-${callId}`).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `outputs/quality-requests-${width}.png`, fullPage: true });
    }
    await page.getByTestId(`quality-request-${callId}`).getByRole("link", { name: "Abrir pedido" }).click();
    await page.getByRole("button", { name: "Iniciar CQ", exact: true }).waitFor();
    await db.user.update({ where: { id: quality.id }, data: { qualityExecutor: false } });
    await page.getByRole("button", { name: "Iniciar CQ", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "autorização para executar CQ" }).waitFor();
    assert.equal((await db.productionQualityCall.findUniqueOrThrow({ where: { id: callId } })).arrivedAt, null);
    await db.user.update({ where: { id: quality.id }, data: { qualityExecutor: true } });
    await page.reload();
    await page.getByRole("button", { name: "Iniciar CQ", exact: true }).click();
    await page.getByRole("button", { name: "Terminar CQ", exact: true }).waitFor();
    const started = await db.productionQualityCall.findUniqueOrThrow({ where: { id: callId } });
    assert.equal(started.technicianId, quality.id); assert.ok(started.arrivedAt);
    const previous = delivered.length; await notifyQualityCall(callId, fakeSend); assert.equal(delivered.length, previous);
    await page.goto(`${base}/producao`);
    await page.getByTestId(`quality-request-${callId}`).getByText(quality.name, { exact: false }).waitFor();
    await page.getByTestId(`quality-request-${callId}`).getByRole("link", { name: "Abrir pedido" }).click();
    await page.getByRole("button", { name: "Terminar CQ", exact: true }).click();
    await page.getByRole("button", { name: "Terminar CQ", exact: true }).waitFor({ state: "detached" });
    assert.ok((await db.productionQualityCall.findUniqueOrThrow({ where: { id: callId } })).endedAt);
    await page.goto(`${base}/producao`);
    assert.equal(await page.getByTestId(`quality-request-${callId}`).count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: access checkbox persists; only active authorized SGQ notified (mock transport); retries deduplicated and failed sends retryable; SGQ queue on desktop/tablet/mobile; denied forged start; authorized self-start/end and queue transition.");
  } finally {
    await browser.close();
    if (batchId) {
      await db.productionAudit.deleteMany({ where: { batchId } });
      await db.productionQualityCall.deleteMany({ where: { batchId } });
      await db.productionBatch.delete({ where: { id: batchId } });
    }
    if (equipmentId) await db.equipment.delete({ where: { id: equipmentId } });
    await db.alertDigestDelivery.deleteMany({ where: { OR: [{ userId: { in: ids } }, ...(callId ? [{ digestDate: callId, channel: "production-quality-call" }] : [])] } });
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
