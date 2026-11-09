import { createHash } from "node:crypto";
import { buildDailyPlanData, lisbonDateValue } from "@/lib/daily-plan";
import { renderPlanEmail } from "@/lib/daily-plan-digest";
import { sendGmail } from "@/lib/gmail";
import { getPrisma } from "@/lib/prisma";

export async function sendTeamPlanTest(token: string) {
  const prisma = getPrisma();
  const hash = createHash("sha256").update(token).digest("hex");
  const grant = await prisma.alertDigestDelivery.findFirst({
    where: { digestDate: hash, channel: "team-plan-test-request", createdAt: { gt: new Date(Date.now() - 86400000) },
      user: { active: true, role: { in: ["ADMIN", "MANAGER"] } } },
    include: { user: true },
  });
  if (!grant) throw new Error("Teste inválido ou expirado.");
  const user = grant.user;
  const date = lisbonDateValue();
  const plan = await buildDailyPlanData(prisma, user, { date, userId: "ALL" });
  const channel = "team-plan-test";
  const sent = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${channel}), hashtext(${user.id}))`;
    const marker = { userId: user.id, channel, digestDate: hash };
    if (await tx.alertDigestDelivery.findUnique({ where: { userId_digestDate_channel: marker } })) return 0;
    const subject = "[Teste] Plano do dia · " + date.split("-").reverse().join("/");
    await sendGmail(user.email, subject, renderPlanEmail(user, plan), "plan-" + hash);
    await tx.alertDigestDelivery.create({ data: { ...marker, subject } });
    return 1;
  }, { timeout: 30000 });
  return { sent, failed: 0, recipients: 1 };
}
