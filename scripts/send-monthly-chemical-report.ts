import { loadEnvConfig } from "@next/env";
import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildMonthlyChemicalReport, monthlyChemicalCsv, sendMonthlyChemicalReport } from "@/lib/chemical-monthly-report";
import { firstBusinessDay, monthlyChemicalSchedule } from "@/lib/chemical-monthly-calendar";
import { isDeliverableEmail } from "@/lib/email-alerts";
import { getPrisma } from "@/lib/prisma";

loadEnvConfig(process.cwd());

async function main() {
  const { values } = parseArgs({ options: { send: { type: "boolean" }, month: { type: "string" }, "not-before": { type: "string" }, output: { type: "string" } } });
  const now = new Date();
  const schedule = monthlyChemicalSchedule(now);
  if (values["not-before"]) {
    firstBusinessDay(values["not-before"]);
    if (schedule.today.slice(0, 7) < values["not-before"]) {
      console.log(JSON.stringify({ skipped: true, firstRunMonth: values["not-before"] }));
      return;
    }
  }
  if (values.send) {
    if (values.month || values.output) throw new Error("--month e --output são apenas para pré-visualização sem envio.");
    const result = await sendMonthlyChemicalReport(now);
    console.log(JSON.stringify(result));
    if (result.failed) process.exitCode = 1;
    return;
  }
  const report = await buildMonthlyChemicalReport(values.month || schedule.month);
  const users = await getPrisma().user.findMany({
    where: { active: true, role: { in: ["HSA", "ADMIN"] } },
    select: { name: true, role: true, email: true },
  });
  if (values.output) {
    const output = resolve(values.output);
    await mkdir(resolve(output, ".."), { recursive: true });
    await writeFile(output, monthlyChemicalCsv(report));
  }
  console.log(JSON.stringify({ dryRun: true, month: report.month, start: report.start, end: report.end, dueDate: schedule.dueDate, smtpConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD), recipients: users.map(user => ({ name: user.name, role: user.role, validEmail: isDeliverableEmail(user.email) })), rows: report.rows }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (process.env.DATABASE_URL) await getPrisma().$disconnect(); });
