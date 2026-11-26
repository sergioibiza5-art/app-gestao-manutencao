import { loadEnvConfig } from "@next/env";
import { randomBytes, createHash } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/email-alerts";
import { openingRequestChannel, openingResendRequestChannel } from "@/lib/chemical-opening-email";
import { openingDeliveryIdentity } from "@/lib/chemical-opening-report";

loadEnvConfig(process.cwd());
async function main() {
  const prisma = getPrisma();
  const resend = process.argv.includes("--resend");
  const recipients = await prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "HSA"] } }, select: { name: true, role: true, email: true } });
  if (!process.argv.includes("--send")) { console.log(JSON.stringify({ dryRun: true, start: "2026-01-01", end: "2026-10-31", recipients })); return; }
  const admins = await prisma.user.findMany({ where: { active: true, role: "ADMIN", name: "Sérgio Cardoso" }, select: { id: true } });
  if (admins.length !== 1) throw new Error("Conta de autorização indisponível ou ambígua.");
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const grant = await prisma.alertDigestDelivery.create({ data: { userId: admins[0].id, channel: resend ? openingResendRequestChannel : openingRequestChannel, digestDate: hash, subject: "Envio autorizado do relatório inicial de 2026" } });
  try {
    const response = await fetch(appBaseUrl() + "/api/cron/monthly-chemicals?report=initial-2026", {
      method: "POST", headers: { authorization: "Bearer " + token }, signal: AbortSignal.timeout(120_000),
    });
    console.log(JSON.stringify({ status: response.status, result: await response.text() }));
    if (!response.ok) process.exitCode = 1;
    const deliveries = await prisma.alertDigestDelivery.findMany({ where: openingDeliveryIdentity(resend, hash), select: { sentAt: true, user: { select: { name: true, email: true, role: true } } } });
    console.log(JSON.stringify({ deliveries }));
  } finally { await prisma.alertDigestDelivery.delete({ where: { id: grant.id } }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => getPrisma().$disconnect());
