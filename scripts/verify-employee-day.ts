import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getEmployeeDay } from "@/lib/employee-day-data";
import { lisbonDay } from "@/lib/daily-maintenance";

loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright");
const base = process.env.EMPLOYEE_TEST_URL || "http://localhost:3014";

async function main() {
  const db = getPrisma(), tag = `employee-qa-${randomBytes(5).toString("hex")}`;
  const userIds: string[] = [];
  const extraBatchIds: string[] = [];
  let equipmentId = "", batchId = "";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const password = randomBytes(16).toString("hex");
    const operator = await db.user.create({ data: { name: `${tag}-operator`, username: tag, email: "", role: "TICKET", password: hashPassword(password) } }); userIds.push(operator.id);
    const other = await db.user.create({ data: { name: `${tag}-other`, email: "", role: "TICKET" } }); userIds.push(other.id);
    const quality = await db.user.create({ data: { name: `${tag}-CQ`, email: "", role: "SGQ" } }); userIds.push(quality.id);
    const manager = await db.user.create({ data: { name: `${tag}-coordinator`, email: "", role: "USER", productionCoordinator: true } }); userIds.push(manager.id);
    const equipment = await db.equipment.create({ data: { name: tag, code: tag, category: "QA" } }); equipmentId = equipment.id;
    const mainEquipment = await db.equipment.findUniqueOrThrow({ where: { code: "MCC_1" }, select: { id: true } });
    await db.ticketEquipmentAccess.create({ data: { userId: operator.id, equipmentId: mainEquipment.id } });
    const batch = await db.productionBatch.create({ data: { reference: tag, lot: tag, equipmentId, createdById: manager.id, status: "OPEN" } }); batchId = batch.id;
    const privateBatch = await db.productionBatch.create({ data: { reference: tag, lot: "PRIVATE-OTHER-BATCH", equipmentId, createdById: other.id, status: "OPEN" } });
    extraBatchIds.push(privateBatch.id);
    const time = (hour: string) => new Date(`2026-11-25T${hour}:00Z`);
    await db.productionActivity.createMany({ data: [
      { batchId, collaboratorId: operator.id, operation: "PCAM", startedAt: time("08:00"), endedAt: time("09:00") },
      { batchId, collaboratorId: operator.id, operation: "EMB", startedAt: time("08:30"), endedAt: time("09:30") },
      { batchId, collaboratorId: other.id, operation: "OUT", notes: "PRIVATE-OTHER", startedAt: time("10:00"), endedAt: time("14:00") },
      { batchId, collaboratorId: operator.id, operation: "PCAM", startedAt: new Date(Date.now() - 1800000) },
    ] });
    await db.productionQualityCall.create({ data: { batchId, technicianId: quality.id, calledAt: time("09:35"), arrivedAt: time("09:40"), endedAt: time("10:00") } });
    await db.dailyMaintenanceEntry.create({ data: { equipmentId, groupKey: "cleaning-daily", day: time("00:00"), revision: 1, documentCode: "QA", noProduction: false,
      checks: { points: [], products: "QA", tools: "", performedBy: "Pessoa que executou" }, recordedById: operator.id, recorderName: operator.name,
      recordedAt: time("09:45"), verifiedById: quality.id, verifierName: quality.name, verifiedAt: new Date(`${lisbonDay()}T12:00:00Z`) } });
    await db.maintenanceTicket.createMany({ data: [
      { number: tag + "-OWN", title: "Pedido próprio", problem: "QA", equipmentId, openedById: operator.id, assignedToId: other.id, openedAt: time("10:00"), totalWorkSeconds: 7200 },
      { number: tag + "-SECRET", title: "PRIVATE-OTHER-TICKET", problem: "QA", equipmentId, openedById: other.id, assignedToId: other.id, openedAt: time("10:00") },
    ] });
    const day = await getEmployeeDay(operator, operator.id, "2026-11-25");
    assert.equal(day.totals.total, 90);
    assert.equal(day.totals.overlap, true);
    assert.equal(day.events.filter(e => e.kind === "Assinatura").length, 1);
    assert.equal(day.events.find(e => e.kind === "Assinatura")?.minutes, undefined);
    assert.equal(day.pending.filter(item => item.id === `batch-${batchId}`).length, 1);
    assert.equal(day.pending.length, 2);
    assert.ok(day.events.every((event, index) => index === 0 || day.events[index - 1].at >= event.at));
    const currentDay = await getEmployeeDay(operator, operator.id, lisbonDay());
    assert.equal(currentDay.current.length, 1);
    assert.equal(currentDay.events.filter(event => event.id === currentDay.current[0].id).length, 0);
    assert.equal(currentDay.pending.filter(item => item.id === `batch-${batchId}`).length, 0);
    assert.ok(!JSON.stringify(currentDay).includes("PRIVATE-OTHER-BATCH"));
    const plannedBatch = await db.productionBatch.create({ data: { reference: tag, lot: "PLANNED-OWN", equipmentId, createdById: operator.id, status: "PLANNED" } });
    extraBatchIds.push(plannedBatch.id);
    assert.equal((await getEmployeeDay(operator, operator.id, lisbonDay())).pending.find(item => item.id === `batch-${plannedBatch.id}`)?.statusLabel, "Lote por iniciar");
    await db.productionBatch.update({ where: { id: plannedBatch.id }, data: { status: "DONE" } });
    assert.equal((await getEmployeeDay(operator, operator.id, lisbonDay())).pending.filter(item => item.id === `batch-${plannedBatch.id}`).length, 0);
    assert.ok(!JSON.stringify(day).includes("PRIVATE-OTHER"));
    await assert.rejects(() => getEmployeeDay(operator, other.id, "2026-11-25"));
    assert.equal((await getEmployeeDay(manager, other.id, "2026-11-25")).totals.total, 240);
    assert.equal((await getEmployeeDay(quality, quality.id, "2026-11-25")).totals.total, 20);
    assert.equal((await getEmployeeDay(quality, quality.id, lisbonDay())).events.filter(e => e.kind === "Verificação").length, 1);
    console.log("PASS DATA: per-person scope, coordinator access, overlap union, CQ excludes waiting, signatures separate, ticket totals excluded.");

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(error.message));
    await page.goto(base + "/login");
    await page.locator('[name="credential"]').fill(tag);
    await page.locator('[name="password"]').fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(base + "/funcionario");
    await page.getByRole("heading", { name: "O meu dia", exact: true }).waitFor();
    assert.equal(await page.locator('select[name="pessoa"]').count(), 0);
    await page.getByRole("heading", { name: "O que tenho em curso" }).waitFor();
    assert.equal(await page.locator('section[aria-labelledby="current-heading"] li').count(), 1);
    assert.equal(await page.locator('section[aria-labelledby="diary-heading"] li').count(), 0);
    assert.equal(await page.locator('section[aria-labelledby="pending-heading"]').getByText(`Lote ${tag}`, { exact: false }).count(), 0);
    const routines = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "Manutenções e limpezas dos equipamentos" }) });
    await routines.locator("summary").click();
    assert.ok(await routines.getByRole("link", { name: "Limpezas", exact: true }).count() > 0);
    assert.ok(await routines.getByRole("link", { name: "Plano preventivo", exact: true }).count() > 0);
    assert.equal(await routines.getByRole("link", { name: "Plano preventivo", exact: true }).count(), 1);
    await routines.locator("summary").click();
    const initial = await page.getByTestId("day-total").innerText();
    assert.ok(initial.startsWith("0h 30m"));
    await page.screenshot({ path: "outputs/employee-day-today.png", fullPage: true });
    await page.getByRole("link", { name: "Gestão de manutenção", exact: true }).click();
    await page.waitForURL(base + "/funcionario");
    await page.locator('[name="dia"]').fill("2026-11-25");
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await page.waitForURL(/dia=2026-11-25/);
    assert.equal(await page.getByTestId("day-total").innerText(), "1h 30m 00s");
    const diaryTitles = await page.locator('section[aria-labelledby="diary-heading"] li h3').allTextContents();
    assert.ok(diaryTitles[0].includes("Pedido próprio"));
    assert.equal(diaryTitles[diaryTitles.length - 1], "Produção de campos");
    await page.getByText("Existem horários sobrepostos.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Por terminar agora" }).count(), 0);
    assert.ok(!(await page.locator("body").innerText()).includes("PRIVATE-OTHER"));
    await page.screenshot({ path: "outputs/employee-day-desktop.png", fullPage: true });
    for (const viewport of [{ width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `outputs/employee-day-${viewport.width}.png`, fullPage: true });
    }
    await page.goto(base + "/funcionario");
    await db.productionActivity.updateMany({ where: { batchId, collaboratorId: operator.id, endedAt: null }, data: { endedAt: new Date() } });
    await page.getByRole("button", { name: "Atualizar registos" }).click();
    const pending = page.locator('section[aria-labelledby="pending-heading"]');
    await pending.getByText(`${tag} · Lote ${tag}`, { exact: true }).waitFor();
    assert.equal(await pending.getByText(`${tag} · Lote ${tag}`, { exact: true }).count(), 1);
    assert.equal(await page.locator('section[aria-labelledby="current-heading"] li').count(), 0);
    await pending.getByText("Lote em curso", { exact: false }).waitFor();
    await page.screenshot({ path: "outputs/employee-day-pending-lot.png", fullPage: true });
    await db.productionBatch.update({ where: { id: batchId }, data: { status: "DONE", endedAt: new Date() } });
    await page.getByRole("button", { name: "Atualizar registos" }).click();
    await pending.getByText(`${tag} · Lote ${tag}`, { exact: true }).waitFor({ state: "detached" });
    const forbidden = await page.goto(`${base}/funcionario?pessoa=${other.id}`);
    assert.equal(forbidden.status(), 404);
    const invalid = await page.goto(base + "/funcionario?dia=2026-02-31");
    assert.equal(invalid.status(), 404);
    const token = randomBytes(32).toString("hex");
    await db.session.create({ data: { token, userId: manager.id, expiresAt: new Date(Date.now() + 3600000) } });
    await context.addCookies([{ name: "casa_sgq_session", value: token, url: base }]);
    await page.goto(`${base}/funcionario?dia=2026-11-25&pessoa=${other.id}`);
    assert.equal(await page.getByTestId("day-total").innerText(), "4h 00m 00s");
    assert.equal(await page.locator('select[name="pessoa"]').inputValue(), other.id);
    await page.goto(base + "/");
    await page.waitForURL(base + "/funcionario");
    assert.deepEqual(errors, []);
    console.log("PASS BROWSER: newest diary first; no current/diary duplication; finished personal activity leaves open lot pending once; closing lot removes it; login, scopes and responsive layouts preserved.");
  } finally {
    await browser.close();
    if (equipmentId) {
      await db.dailyMaintenanceEntry.deleteMany({ where: { equipmentId } });
      await db.maintenanceTicket.deleteMany({ where: { equipmentId } });
    }
    if (batchId) {
      await db.productionActivity.deleteMany({ where: { batchId } });
      await db.productionQualityCall.deleteMany({ where: { batchId } });
      await db.productionBatch.delete({ where: { id: batchId } });
    }
    await db.productionBatch.deleteMany({ where: { id: { in: extraBatchIds } } });
    if (equipmentId) await db.equipment.delete({ where: { id: equipmentId } });
    await db.session.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
