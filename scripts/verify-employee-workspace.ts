import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/prisma";
import { lisbonDay } from "@/lib/daily-maintenance";
import { employeeDayWindow } from "@/lib/employee-day";
import { getEmployeeDay } from "@/lib/employee-day-data";
import { getEmployeeRoutines } from "@/lib/employee-routines";
import { getEmployeeTeam } from "@/lib/employee-team";

loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright");
const base = process.env.EMPLOYEE_TEST_URL || "http://localhost:3014";

async function main() {
  const db = getPrisma(), tag = `workspace-qa-${randomBytes(4).toString("hex")}`;
  const userIds: string[] = [], batchIds: string[] = [];
  let equipmentId = "";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const actor = await db.user.create({ data: { name: `${tag}-operador`, email: "", role: "TICKET" } }); userIds.push(actor.id);
    const other = await db.user.create({ data: { name: `${tag}-outro`, email: "", role: "TICKET" } }); userIds.push(other.id);
    const stale = await db.user.create({ data: { name: `${tag}-esquecida`, email: "", role: "TICKET" } }); userIds.push(stale.id);
    const cq = await db.user.create({ data: { name: `${tag}-qualidade`, email: "", role: "SGQ" } }); userIds.push(cq.id);
    const coordinator = await db.user.create({ data: { name: `${tag}-coordenador`, email: "", role: "USER", productionCoordinator: true } }); userIds.push(coordinator.id);
    const admin = await db.user.create({ data: { name: `${tag}-admin`, email: "", role: "ADMIN" } }); userIds.push(admin.id);
    const equipment = await db.equipment.create({ data: { name: tag, code: tag, category: "QA" } }); equipmentId = equipment.id;
    const batch = await db.productionBatch.create({ data: { reference: "Teste de atividade individual", lot: tag, equipmentId, createdById: coordinator.id, status: "OPEN" } }); batchIds.push(batch.id);
    const warningBatch = await db.productionBatch.create({ data: { reference: "Atividade esquecida", lot: tag + "-aviso", equipmentId, createdById: coordinator.id, status: "OPEN" } }); batchIds.push(warningBatch.id);
    const ownActivity = await db.productionActivity.create({ data: { batchId: batch.id, collaboratorId: actor.id, operation: "PCAM", startedAt: new Date(Date.now() - 1800000) } });
    const otherActivity = await db.productionActivity.create({ data: { batchId: batch.id, collaboratorId: other.id, operation: "EMB", startedAt: new Date(Date.now() - 60000) } });
    const oldActivity = await db.productionActivity.create({ data: { batchId: warningBatch.id, collaboratorId: stale.id, operation: "PCAM", startedAt: new Date(employeeDayWindow(lisbonDay()).start.getTime() - 60000) } });
    const quality = await db.productionQualityCall.create({ data: { batchId: batch.id, technicianId: cq.id, calledAt: new Date(Date.now() - 60000) } });
    const mcc = await db.equipment.findUniqueOrThrow({ where: { code: "MCC_1" }, select: { id: true } });
    await db.ticketEquipmentAccess.create({ data: { userId: actor.id, equipmentId: mcc.id } });
    assert.deepEqual(await getEmployeeRoutines(other, lisbonDay()), []);
    const routines = await getEmployeeRoutines(actor, lisbonDay());
    assert.ok(routines.some(unit => unit.equipment.id === mcc.id && unit.tasks.some(task => task.cleaning)));
    assert.ok(routines.flatMap(unit => unit.tasks).every(task => !!task.statusLabel && !!task.label));
    await assert.rejects(() => getEmployeeTeam(actor, lisbonDay()));
    await assert.rejects(() => getEmployeeTeam(admin, lisbonDay()));
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(error.message));
    const login = async (id: string) => {
      const token = randomBytes(32).toString("hex");
      await db.session.create({ data: { token, userId: id, expiresAt: new Date(Date.now() + 3600000) } });
      await context.addCookies([{ name: "casa_sgq_session", value: token, url: base }]);
      await page.goto(base + "/funcionario");
      await page.getByRole("heading", { name: "O meu dia", exact: true }).waitFor();
    };
    await login(actor.id);
    assert.equal(await page.getByRole("link", { name: "O dia da equipa", exact: true }).count(), 0);
    assert.equal(await page.locator('input[type="datetime-local"]').count(), 0);
    await page.getByRole("heading", { name: "Limpezas e preventivas", exact: true }).waitFor();
    const control = page.getByRole("button", { name: "Terminar a minha atividade", exact: true });
    const form = control.locator("xpath=ancestor::form");
    await form.locator('[name="id"]').evaluate((el: HTMLInputElement, id: string) => { el.value = id; }, otherActivity.id);
    await control.click();
    await form.getByRole("status").filter({ hasText: "Só podes terminar uma atividade tua" }).waitFor();
    assert.equal((await db.productionActivity.findUniqueOrThrow({ where: { id: otherActivity.id } })).endedAt, null);
    await form.locator('[name="id"]').evaluate((el: HTMLInputElement, id: string) => { el.value = id; }, ownActivity.id);
    await control.click();
    await page.getByRole("button", { name: "Retomar atividade", exact: true }).waitFor();
    const originalEnd = (await db.productionActivity.findUniqueOrThrow({ where: { id: ownActivity.id } })).endedAt;
    assert.ok(originalEnd);
    assert.equal((await db.productionBatch.findUniqueOrThrow({ where: { id: batch.id } })).status, "OPEN");
    assert.equal((await db.productionActivity.findUniqueOrThrow({ where: { id: otherActivity.id } })).endedAt, null);
    await page.getByText("A tua atividade terminou. O lote continua aberto.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Fechar lote", exact: true }).count(), 0);
    const beforeResume = Date.now();
    const resume = page.getByRole("button", { name: "Retomar atividade", exact: true });
    await resume.locator("xpath=ancestor::form").evaluate((el: HTMLFormElement, otherId: string) => {
      for (const [name, value] of [["startedAt", "2026-01-01T00:00"], ["endedAt", "2026-01-02T00:00"], ["collaboratorId", otherId], ["operation", "OUT"]]) {
        const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; el.append(input);
      }
    }, other.id);
    await resume.click();
    await page.getByRole("button", { name: "Terminar a minha atividade", exact: true }).waitFor();
    const sessions = await db.productionActivity.findMany({ where: { batchId: batch.id, collaboratorId: actor.id }, orderBy: { startedAt: "asc" } });
    assert.equal(sessions.length, 2);
    assert.equal(sessions[0].endedAt?.getTime(), originalEnd.getTime());
    assert.ok(sessions[1].startedAt.getTime() >= beforeResume - 1000);
    assert.equal(sessions[1].operation, "PCAM");
    assert.equal(sessions[1].endedAt, null);
    assert.equal(await db.productionAudit.count({ where: { batchId: batch.id, actorId: actor.id } }), 2);
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const routineDetails = page.locator('#routine-tasks details').first();
      if (!await routineDetails.evaluate((el: HTMLDetailsElement) => el.open)) await routineDetails.locator("summary").click();
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `outputs/employee-workspace-${viewport.width}.png`, fullPage: true });
    }
    await page.getByRole("button", { name: "Terminar a minha atividade", exact: true }).click();
    await page.getByRole("button", { name: "Retomar atividade", exact: true }).waitFor();
    const forbidden = await page.goto(base + "/funcionario/equipa");
    assert.equal(forbidden.status(), 404);
    await login(stale.id);
    await page.getByRole("alert").filter({ hasText: "atividade aberta desde outro dia" }).waitFor();
    assert.equal((await db.productionActivity.findUniqueOrThrow({ where: { id: oldActivity.id } })).endedAt, null);
    await login(cq.id);
    await page.getByRole("button", { name: "Iniciar o meu CQ", exact: true }).click();
    await page.getByRole("button", { name: "Terminar o meu CQ", exact: true }).waitFor();
    await page.getByRole("button", { name: "Terminar o meu CQ", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('section[aria-labelledby="current-heading"] li').length === 0);
    assert.ok((await db.productionQualityCall.findUniqueOrThrow({ where: { id: quality.id } })).endedAt);
    await login(coordinator.id);
    await page.getByRole("link", { name: "O dia da equipa", exact: true }).click();
    await page.getByRole("heading", { name: "O dia da equipa", exact: true }).waitFor();
    await page.locator('[name="q"]').fill(tag);
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await page.waitForURL(/q=workspace-qa/);
    const staleRow = page.getByTestId(`team-person-${stale.id}`);
    await staleRow.getByText("atividade(s) aberta(s) desde outro dia", { exact: false }).waitFor();
    const team = await getEmployeeTeam(coordinator, lisbonDay());
    assert.ok(team.every(row => row.person.role === "TICKET"));
    assert.deepEqual(team.filter(row => row.person.name.startsWith(tag)).map(row => row.person.id).sort(), [actor.id, other.id, stale.id].sort());
    assert.equal(await page.getByTestId(`team-person-${cq.id}`).count(), 0);
    assert.equal(await page.getByTestId(`team-person-${coordinator.id}`).count(), 0);
    assert.equal(await page.getByTestId(`team-person-${admin.id}`).count(), 0);
    const teamCount = page.locator('section[aria-label="Resumo da equipa"] > div').first().locator("p").last();
    await teamCount.filter({ hasText: /^3$/ }).waitFor();
    assert.equal(await teamCount.innerText(), "3");
    const own = await getEmployeeDay(actor, actor.id, lisbonDay());
    assert.ok(Math.abs(team.find(row => row.person.id === actor.id)!.totals.total - own.totals.total) < 0.01);
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `outputs/employee-team-${viewport.width}.png`, fullPage: true });
    }
    await staleRow.getByRole("link", { name: "Ver dia", exact: true }).click();
    await page.getByRole("heading", { name: "Dia do colaborador", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Terminar a minha atividade", exact: true }).count(), 0);
    await login(admin.id);
    assert.equal((await page.goto(base + "/funcionario/equipa")).status(), 404);
    assert.deepEqual(errors, []);
    console.log("PASS: personal finish/resume with new audited periods; forged ownership/timestamps ignored or denied; lot and coworker unchanged; routine grants/states; stale alert without auto-close; own CQ controls; coordinator-only team and read-only drilldown; desktop/tablet/mobile.");
  } catch (error) {
    console.error("Workspace verification failed:", error);
    throw error;
  } finally {
    await browser.close();
    await db.$transaction(async tx => {
      for (const id of batchIds) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('production-batch'), hashtext(${id}))`;
      await tx.productionAudit.deleteMany({ where: { batchId: { in: batchIds } } });
      await tx.productionActivity.deleteMany({ where: { batchId: { in: batchIds } } });
      await tx.productionQualityCall.deleteMany({ where: { batchId: { in: batchIds } } });
      await tx.productionBatch.deleteMany({ where: { id: { in: batchIds } } });
    });
    if (equipmentId) await db.equipment.delete({ where: { id: equipmentId } });
    await db.session.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
