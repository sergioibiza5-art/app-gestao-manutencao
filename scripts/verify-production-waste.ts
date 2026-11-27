import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { getPrisma } from "@/lib/prisma";
loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright");
const base = process.env.PRODUCTION_TEST_URL || "http://localhost:3014";

async function main() {
  const db = getPrisma(), tag = `waste-qa-${randomBytes(4).toString("hex")}`;
  const users: string[] = [], batches: string[] = [];
  let equipmentId = "";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const coordinator = await db.user.create({ data: { name: tag + "-coordinator", email: "", role: "USER", productionCoordinator: true } }); users.push(coordinator.id);
    const operator = await db.user.create({ data: { name: tag + "-operator", email: "", role: "TICKET" } }); users.push(operator.id);
    const technician = await db.user.create({ data: { name: tag + "-quality", email: "", role: "SGQ" } }); users.push(technician.id);
    const equipment = await db.equipment.create({ data: { name: tag, code: tag, category: "QA" } }); equipmentId = equipment.id;
    const anchor = Date.now();
    const batch = await db.productionBatch.create({ data: { reference: tag, lot: tag, equipmentId, createdById: coordinator.id, status: "OPEN", startedAt: new Date(anchor - 180000) } }); batches.push(batch.id);
    await db.productionActivity.create({ data: { batchId: batch.id, collaboratorId: operator.id, operation: "PCAM", startedAt: new Date(anchor - 120000), endedAt: new Date(anchor - 60000) } });
    await db.productionQualityCall.create({ data: { batchId: batch.id, technicianId: technician.id, calledAt: new Date(anchor - 100000), arrivedAt: new Date(anchor - 80000), endedAt: new Date(anchor - 40000) } });
    const old = await db.productionBatch.create({ data: { reference: tag, lot: tag + "-old", equipmentId, createdById: coordinator.id, status: "DONE" } }); batches.push(old.id);
    const zero = await db.productionBatch.create({ data: { reference: tag, lot: tag + "-zero", equipmentId, createdById: coordinator.id, status: "OPEN", startedAt: new Date() } }); batches.push(zero.id);
    assert.equal(old.wasteQuantity, null);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(error.message));
    const setUser = async (userId: string) => {
      const token = randomBytes(32).toString("hex");
      await db.session.create({ data: { token, userId, expiresAt: new Date(Date.now() + 3600000) } });
      await context.addCookies([{ name: "casa_sgq_session", value: token, url: base }]);
    };
    const summary = async (id: string) => {
      const response = await context.request.get(`${base}/api/producao/${id}/export?format=xlsx`);
      assert.equal(response.status(), 200);
      return XLSX.utils.sheet_to_json<(string | number)[]>(XLSX.read(await response.body(), { type: "buffer" }).Sheets.Resumo, { header: 1 });
    };
    await setUser(coordinator.id);
    assert.equal((await summary(old.id)).find(row => row[0] === "Quantidade desperdício")?.[1], "Não registado");
    await page.goto(`${base}/producao?lote=${batch.id}`);
    await page.getByRole("button", { name: "Fechar lote", exact: true }).click();
    const dialog = page.getByRole("dialog"), waste = dialog.getByLabel("Quantidade final desperdício", { exact: true });
    await waste.waitFor();
    assert.equal(await waste.inputValue(), "0");
    await dialog.getByLabel("Quantidade final produzida", { exact: true }).fill("512");
    await waste.fill("7.125");
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const producedBox = await dialog.getByLabel("Quantidade final produzida", { exact: true }).boundingBox();
      const wasteBox = await waste.boundingBox();
      assert.ok(producedBox && wasteBox && wasteBox.y >= producedBox.y + producedBox.height);
      assert.equal(await dialog.evaluate((el: HTMLElement) => el.scrollWidth > el.clientWidth + 1), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `outputs/production-waste-${viewport.width}.png`, fullPage: true });
    }
    await dialog.locator('[name="confirmClose"]').check();
    await dialog.locator("form").evaluate((el: HTMLFormElement) => { el.noValidate = true; });
    await waste.evaluate((el: HTMLInputElement) => { el.type = "text"; el.required = false; });
    for (const invalid of ["-1", "", "1.2345", "100000000000"]) {
      await waste.fill(invalid);
      await dialog.getByTestId("confirm-close-batch").click();
      await dialog.getByRole("status").filter({ hasText: "Quantidade final de desperdício inválida" }).waitFor();
      const unchanged = await db.productionBatch.findUniqueOrThrow({ where: { id: batch.id } });
      assert.equal(unchanged.status, "OPEN"); assert.equal(unchanged.wasteQuantity, null);
      assert.equal(unchanged.quantity.toString(), "0");
    }
    await waste.evaluate((el: HTMLInputElement) => { el.type = "text"; });
    await waste.fill("7,125");
    await setUser(operator.id);
    await dialog.getByTestId("confirm-close-batch").click();
    await dialog.getByRole("status").filter({ hasText: "Só um coordenador" }).waitFor();
    assert.equal((await db.productionBatch.findUniqueOrThrow({ where: { id: batch.id } })).status, "OPEN");
    await setUser(coordinator.id);
    await waste.evaluate((el: HTMLInputElement) => { el.type = "number"; });
    await waste.fill("7.125");
    await dialog.getByTestId("confirm-close-batch").click();
    await dialog.waitFor({ state: "detached" });
    const closed = await db.productionBatch.findUniqueOrThrow({ where: { id: batch.id } });
    assert.equal(closed.status, "DONE"); assert.equal(closed.quantity.toString(), "512"); assert.equal(closed.wasteQuantity?.toString(), "7.125");
    const audit = await db.productionAudit.findFirstOrThrow({ where: { batchId: batch.id, action: "Lote terminado" } });
    assert.equal((audit.after as { wasteQuantity: string }).wasteQuantity, "7.125");
    const reports = page.getByTestId("production-reports");
    if (!await reports.evaluate((el: HTMLDetailsElement) => el.open)) await reports.locator(":scope > summary").click();
    const productionTable = page.getByTestId("production-operator-summary"), qualityTable = page.getByTestId("production-quality-summary");
    await productionTable.getByText(operator.name, { exact: false }).waitFor();
    await qualityTable.getByText(technician.name, { exact: false }).waitFor();
    assert.equal(await productionTable.getByText(technician.name, { exact: false }).count(), 0);
    assert.equal(await qualityTable.getByText(operator.name, { exact: false }).count(), 0);
    assert.ok((await productionTable.locator("tfoot").innerText()).includes("0h 01m 00s"));
    assert.ok((await qualityTable.locator("tfoot").innerText()).includes("0h 00m 40s"));
    assert.equal(await reports.getByText("Total de todas as pessoas", { exact: true }).count(), 0);
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `outputs/production-separated-times-${viewport.width}.png`, fullPage: true });
    }
    const visibleWaste = page.locator("dl > div").filter({ has: page.getByText("Quantidade desperdício", { exact: true }) });
    await visibleWaste.getByText("7.125 un", { exact: true }).waitFor();
    const rows = await summary(batch.id);
    assert.equal(rows.find(row => row[0] === "Quantidade desperdício")?.[1], 7.125);
    assert.equal(rows.find(row => row[0] === "Quantidade produzida")?.[1], 512);
    const exportPeople = await context.request.get(`${base}/api/producao/${batch.id}/export?format=xlsx`);
    const peopleRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(XLSX.read(await exportPeople.body(), { type: "buffer" }).Sheets.Pessoas);
    assert.ok(Math.abs(Number(peopleRows.find(row => row.Colaborador === "Total de produção")?.["Total (h)"]) - 1 / 60) < 1e-12);
    assert.ok(Math.abs(Number(peopleRows.find(row => row.Colaborador === "Total de CQ")?.["Total (h)"]) - 40 / 3600) < 1e-12);
    assert.equal(peopleRows.find(row => row.Colaborador === operator.name)?.["CQ (h)"], 0);
    assert.equal(peopleRows.find(row => row.Colaborador === technician.name)?.["Produção (h)"], 0);
    const pdf = await context.request.get(`${base}/api/producao/${batch.id}/export?format=pdf`);
    assert.equal(pdf.status(), 200); assert.ok(pdf.headers()["content-type"].includes("application/pdf"));
    writeFileSync("outputs/production-waste.pdf", await pdf.body());
    const coordination = page.getByTestId("production-coordination");
    if (!await coordination.evaluate((el: HTMLDetailsElement) => el.open)) await coordination.locator(":scope > summary").click();
    await page.getByRole("button", { name: "Conferir lote", exact: true }).click();
    await page.getByRole("button", { name: "Conferir lote", exact: true }).waitFor({ state: "detached" });
    assert.equal((await db.productionBatch.findUniqueOrThrow({ where: { id: batch.id } })).wasteQuantity?.toString(), "7.125");
    await page.goto(`${base}/producao?lote=${zero.id}`);
    await page.getByRole("button", { name: "Fechar lote", exact: true }).click();
    await page.getByRole("dialog").locator('[name="confirmClose"]').check();
    await page.getByRole("dialog").getByTestId("confirm-close-batch").click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal((await db.productionBatch.findUniqueOrThrow({ where: { id: zero.id } })).wasteQuantity?.toString(), "0");
    assert.deepEqual(errors, []);
    console.log("PASS: waste input below produced quantity; invalid and unauthorized close denied; separate quantities persisted and audited; zero differs from old unknown; independent Production/CQ people, timestamps and totals on desktop/tablet/mobile and Excel/PDF.");
  } catch (error) {
    console.error("Production verification failed:", error);
    for (const page of browser.contexts().flatMap((context: { pages(): unknown[] }) => context.pages())) {
      const currentPage = page as { url(): string; locator(selector: string): { evaluateAll<T>(fn: (nodes: HTMLInputElement[]) => T): Promise<T> } };
      console.error("Page", currentPage.url(), await currentPage.locator("dialog input").evaluateAll(nodes => nodes.map(input => ({ name: input.name, type: input.type, value: input.value, checked: input.checked, validation: input.validationMessage }))));
    }
    throw error;
  } finally {
    await browser.close();
    await db.$transaction(async tx => {
      for (const id of batches) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('production-batch'), hashtext(${id}))`;
      await tx.productionAudit.deleteMany({ where: { batchId: { in: batches } } });
      await tx.productionActivity.deleteMany({ where: { batchId: { in: batches } } });
      await tx.productionQualityCall.deleteMany({ where: { batchId: { in: batches } } });
      await tx.productionBatch.deleteMany({ where: { id: { in: batches } } });
    });
    if (equipmentId) await db.equipment.delete({ where: { id: equipmentId } });
    await db.session.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
