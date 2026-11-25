import { createHash, randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { getPrisma } from "@/lib/prisma";
import { chemicalTestRequestChannel } from "@/lib/chemical-monthly-test";
import { lisbonDate } from "@/lib/chemical-report-utils";
import { appBaseUrl, isDeliverableEmail } from "@/lib/email-alerts";

loadEnvConfig(process.cwd());

async function main() {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: { active: true, role: "ADMIN", name: "Sérgio Cardoso" },
    select: { id: true, name: true, email: true },
  });
  if (users.length !== 1 || !isDeliverableEmail(users[0].email)) throw new Error("Destinatário do teste indisponível ou ambíguo.");
  const user = users[0];
  const month = lisbonDate(new Date()).slice(0, 7);
  if (!process.argv.includes("--send")) {
    console.log(JSON.stringify({ recipient: user.name, email: user.email, month, dryRun: true }));
    return;
  }
  const token = randomBytes(32).toString("hex");
  const grant = await prisma.alertDigestDelivery.create({ data: {
    userId: user.id, channel: chemicalTestRequestChannel,
    digestDate: createHash("sha256").update(token).digest("hex"), subject: month,
  } });
  try {
    const response = await fetch(appBaseUrl() + "/api/cron/monthly-chemicals", {
      method: "POST", headers: { authorization: "Bearer " + token }, signal: AbortSignal.timeout(120_000),
    });
    const body = await response.text();
    console.log(JSON.stringify({ recipient: user.name, email: user.email, status: response.status, result: body }));
    if (!response.ok) process.exitCode = 1;
  } finally {
    await prisma.alertDigestDelivery.delete({ where: { id: grant.id } });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => getPrisma().$disconnect());
