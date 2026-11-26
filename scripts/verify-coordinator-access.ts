import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/prisma";
loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright");
const base = process.env.EMPLOYEE_TEST_URL || "http://localhost:3014";

async function main() {
  const db = getPrisma(), tag = `coordinator-access-qa-${randomBytes(4).toString("hex")}`, ids: string[] = [];
  const ticketIds: string[] = [];
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const mcc = await db.equipment.findUniqueOrThrow({ where: { code: "MCC_1" }, select: { id: true } });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    const admin = await db.user.create({ data: { name: tag + "-admin", email: "", role: "ADMIN" } }); ids.push(admin.id);
    const login = async (userId: string) => {
      const token = randomBytes(32).toString("hex");
      await db.session.create({ data: { token, userId, expiresAt: new Date(Date.now() + 3600000) } });
      await context.addCookies([{ name: "casa_sgq_session", value: token, url: base }]);
    };
    await login(admin.id);
    await page.goto(base + "/despesas");
    const expenseForm = page.locator('form').filter({ has: page.locator('input[name="title"]') }).first();
    const action = await expenseForm.locator('input[name^="$ACTION_ID_"]').getAttribute("name");
    assert.ok(action);
    assert.equal((await context.request.get(base + "/acessos", { maxRedirects: 0 })).status(), 200);
    const blocked = ["/inventario", "/despesas", "/plano", "/manutencao", "/acessos", "/equipamentos", `/equipamentos/${mcc.id}`, "/documentos", "/localizacoes", "/tarefas", "/ferias", "/frota", "/calibracao", "/ambiental", "/analises", "/kpis", "/api/inventario/pdf", "/api/kpis/pdf", "/api/ambiental/pdf", "/api/inventario/quimicos", "/api/manutencao/ops/forbidden/pdf"];
    for (const role of ["MANAGER", "TICKET", "ADMIN"] as const) {
      const user = await db.user.create({ data: { name: `${tag}-${role}`, email: "", role, productionCoordinator: true } }); ids.push(user.id);
      await db.ticketEquipmentAccess.create({ data: { userId: user.id, equipmentId: mcc.id } });
      await login(user.id);
      await page.goto(base + "/");
      await page.waitForURL(base + "/funcionario");
      const nav = await page.locator('nav[aria-label="Módulos"]:visible a').evaluateAll((links: HTMLAnchorElement[]) => links.map(link => new URL(link.href).pathname));
      assert.deepEqual(nav.sort(), ["/funcionario", "/producao", "/tickets"].sort());
      for (const path of blocked) {
        const response = await context.request.get(base + path, { maxRedirects: 0, headers: { "x-app-pathname": "/tickets" } });
        assert.ok([303, 307].includes(response.status()), `${role}: ${path} returned ${response.status()}`);
        assert.ok(response.headers().location?.endsWith("/funcionario"));
      }
      for (const path of ["/producao", "/tickets", "/funcionario/equipa", `/equipamentos/${mcc.id}/rotina-diaria?grupo=daily`, `/equipamentos/${mcc.id}/rotina-diaria?grupo=cleaning-daily`]) {
        const response = await context.request.get(base + path, { maxRedirects: 0 });
        assert.equal(response.status(), 200, `${role}: allowed ${path}`);
      }
      const report = await context.request.get(`${base}/equipamentos/${mcc.id}/rotina-diaria/pdf?grupo=cleaning-daily`);
      assert.equal(report.status(), 200);
      assert.ok(report.headers()["content-type"].includes("application/pdf"));
      await page.goto(`${base}/equipamentos/${mcc.id}/rotina-diaria?grupo=cleaning-daily`);
      await page.getByRole("heading", { name: "Limpezas", exact: true }).waitFor();
      await page.getByRole("link", { name: "O meu dia", exact: true }).click();
      await page.waitForURL(base + "/funcionario");
      const deniedAction = await context.request.post(base + "/tickets", { maxRedirects: 0,
        headers: { Origin: base }, multipart: { [action!]: "", title: tag, amount: "1", category: "QA" } });
      assert.ok([303, 307].includes(deniedAction.status()), `Forged expense action: ${deniedAction.status()}`);
      assert.equal(await db.expense.count({ where: { title: tag } }), 0);
      if (role === "MANAGER") {
        const ticket = await db.maintenanceTicket.create({ data: { number: tag + "-TICKET", title: tag, problem: "Temporary permission test", equipmentId: mcc.id, openedById: user.id, assignedToId: user.id, machineStopped: false } });
        ticketIds.push(ticket.id);
        await page.goto(`${base}/tickets?ticketId=${ticket.id}`);
        const card = page.locator(`#ticket-${ticket.id}`);
        await card.getByRole("button", { name: "Iniciar", exact: true }).click();
        await card.getByRole("button", { name: "Pausar", exact: true }).waitFor();
        assert.equal((await db.maintenanceTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status, "IN_PROGRESS");
        await card.getByRole("button", { name: "Pausar", exact: true }).click();
        await card.getByRole("button", { name: "Retomar", exact: true }).waitFor();
        assert.equal((await db.maintenanceTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status, "PAUSED");
        await page.goto(base + "/funcionario");
      }
      if (role === "MANAGER") await page.screenshot({ path: "outputs/coordinator-restricted-desktop.png", fullPage: true });
    }
    await login(admin.id);
    assert.equal((await context.request.get(base + "/inventario", { maxRedirects: 0 })).status(), 200);
    assert.deepEqual(errors, []);
    console.log("PASS: Manager/Ticket/Admin coordinators limited to Production/Tickets/employee/team; forged route header and non-ticket server actions blocked; ticket start/pause, preventive/cleaning forms and PDF preserved; ordinary admin unaffected.");
  } finally {
    await browser.close();
    await db.maintenanceTicket.deleteMany({ where: { id: { in: ticketIds } } });
    await db.expense.deleteMany({ where: { title: tag } });
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
