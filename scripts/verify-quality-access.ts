import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/prisma";
import { isDeliverableEmail } from "@/lib/email-alerts";
loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright");
const base = process.env.PRODUCTION_TEST_URL || "http://localhost:3019";

async function main() {
  const db = getPrisma(), tag = `cq-access-qa-${randomBytes(4).toString("hex")}`, ids: string[] = [];
  let equipmentId = "", batchId = "";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const admin = await db.user.create({ data: { name: `${tag}-admin`, email: "", role: "ADMIN" } }); ids.push(admin.id);
    const person = await db.user.create({ data: { name: tag, username: tag, email: `${tag}@ticket.local`, role: "TICKET" } }); ids.push(person.id);
    equipmentId = (await db.equipment.create({ data: { code: tag, name: tag, category: "QA" } })).id;
    batchId = (await db.productionBatch.create({ data: { reference: tag, lot: tag, equipmentId, createdById: admin.id, status: "OPEN", startedAt: new Date() } })).id;
    const call = await db.productionQualityCall.create({ data: { batchId, calledAt: new Date() } });
    const context = await browser.newContext();
    const page = await context.newPage();
    const session = async (id: string) => {
      const token = randomBytes(32).toString("hex");
      await db.session.create({ data: { token, userId: id, expiresAt: new Date(Date.now() + 3600000) } });
      return token;
    };
    const personToken = await session(person.id);
    const personContext = await browser.newContext();
    await personContext.addCookies([{ name: "casa_sgq_session", value: personToken, url: base }]);
    assert.equal((await personContext.request.get(`${base}/api/producao/quality-requests`)).status(), 403);
    const personPage = await personContext.newPage();
    await personPage.goto(`${base}/producao`);
    assert.equal(await personPage.getByTestId("quality-request-popup").count(), 0);
    await context.addCookies([{ name: "casa_sgq_session", value: await session(admin.id), url: base }]);
    await page.goto(`${base}/acessos`);
    const form = page.locator("form").filter({ has: page.locator(`input[name="id"][value="${person.id}"]`) }).first();
    assert.equal(await form.locator('[name="email"]').inputValue(), "");
    await form.locator('[name="role"]').selectOption("SGQ");
    await form.getByLabel("Pode executar controlo de qualidade", { exact: true }).check();
    const saved = page.waitForResponse((r: { url(): string; request(): { method(): string } }) => r.request().method() === "POST" && new URL(r.url()).pathname === "/acessos");
    await form.getByRole("button", { name: "Atualizar", exact: true }).click();
    await saved;
    const updated = await db.user.findUniqueOrThrow({ where: { id: person.id } });
    assert.equal(updated.role, "SGQ"); assert.equal(updated.qualityExecutor, true);
    assert.equal(updated.email, ""); assert.equal(updated.username, person.username);
    assert.equal(updated.password, person.password); assert.equal(updated.mustChangePassword, person.mustChangePassword);
    assert.equal(isDeliverableEmail(updated.email), false);
    await page.reload();
    assert.equal(await form.getByLabel("Pode executar controlo de qualidade", { exact: true }).isChecked(), true);
    assert.equal(await form.locator('[name="role"]').inputValue(), "SGQ");
    assert.equal((await personContext.request.get(`${base}/api/producao/quality-requests`)).status(), 200);
    await personPage.reload();
    await personPage.getByTestId(`quality-popup-${call.id}`).waitFor();
    assert.equal(await personContext.cookies().then((cookies: { name: string; value: string }[]) => cookies.find(c => c.name === "casa_sgq_session")?.value), personToken);
    console.log("PASS: Ticket account converted through Access UI to authorized SGQ with empty email; role and flag persist; same session receives CQ popup after refresh; username/password preserved; no real email address invented and no emails sent.");
  } finally {
    await browser.close();
    if (batchId) {
      await db.productionQualityCall.deleteMany({ where: { batchId } });
      await db.productionBatch.delete({ where: { id: batchId } });
    }
    if (equipmentId) await db.equipment.delete({ where: { id: equipmentId } });
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
