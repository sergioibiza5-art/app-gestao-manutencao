import type { PrismaClient, User } from "@prisma/client";

import { buildDailyPlanData, dailyPlanCount, lisbonDateValue } from "@/lib/daily-plan";
import { formatDate, formatShortDate } from "@/lib/format";
import { getPrisma } from "@/lib/prisma";

type DigestOptions = {
  date?: string;
  force?: boolean;
};

type DigestUser = User;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isDeliverableEmail(email: string) {
  const value = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith(".local");
}

function appBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app-gestao-manutencao.vercel.app").replace(/\/$/, "");
}

function absoluteUrl(path: string) {
  return `${appBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em curso",
    OPEN: "Aberto",
    PAUSED: "Pausado",
    SUSPENDED: "Suspenso",
  };

  return labels[status] ?? status;
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    LOW: "Baixa",
    NORMAL: "Normal",
    HIGH: "Alta",
    CRITICAL: "Crítica",
  };

  return labels[priority] ?? priority;
}

function rows(title: string, items: string[]) {
  if (items.length === 0) return "";

  return `
    <h2 style="margin:24px 0 10px;font-size:18px;color:#0f766e">${escapeHtml(title)}</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #dbe4ea">
      <tbody>${items.join("")}</tbody>
    </table>
  `;
}

function row(label: string, meta: string, href: string, tone = "#111827") {
  return `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #e5edf2">
        <a href="${escapeHtml(absoluteUrl(href))}" style="font-weight:700;color:${tone};text-decoration:none">${escapeHtml(label)}</a>
        <div style="margin-top:4px;color:#64748b;font-size:13px;line-height:1.5">${escapeHtml(meta)}</div>
      </td>
    </tr>
  `;
}

function renderPlanEmail(user: DigestUser, plan: Awaited<ReturnType<typeof buildDailyPlanData>>) {
  const title = plan.isTeamView ? "Plano diário da equipa" : `Plano diário de ${user.name}`;
  const count = dailyPlanCount(plan);
  const taskRows = plan.tasks.map((task) =>
    row(
      task.title,
      `${task.equipment?.name ?? "Sem equipamento"} · ${statusLabel(task.status)} · ${formatShortDate(task.dueDate ?? task.nextDue)}`,
      task.href,
      task.isLate ? "#b91c1c" : "#111827",
    ),
  );
  const scheduleRows = plan.schedules.map((schedule) =>
    row(
      schedule.title,
      `${schedule.equipment.name} · ${formatDate(schedule.scheduledAt)} · ${schedule.assignedTo?.name ?? "Sem responsável"}`,
      schedule.href,
      schedule.isLate ? "#b91c1c" : "#111827",
    ),
  );
  const ticketRows = plan.tickets.map((ticket) =>
    row(
      `${ticket.number} · ${ticket.title}`,
      `${ticket.equipment.name} · ${priorityLabel(ticket.priority)} · ${statusLabel(ticket.status)} · ${ticket.assignedTo?.name ?? "Sem responsável"}`,
      ticket.href,
      ticket.priority === "CRITICAL" || ticket.priority === "HIGH" ? "#b45309" : "#111827",
    ),
  );
  const triageRows = plan.triageTickets.map((ticket) =>
    row(
      `${ticket.number} · ${ticket.title}`,
      `${ticket.equipment.name} · ${priorityLabel(ticket.priority)} · aberto por ${ticket.openedBy?.name ?? "Sistema"}`,
      ticket.href,
      ticket.priority === "CRITICAL" || ticket.priority === "HIGH" ? "#b91c1c" : "#92400e",
    ),
  );

  return `
    <div style="margin:0;background:#f6f8fb;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#111827">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ea;border-radius:12px;padding:28px">
        <p style="margin:0 0 8px;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Gestão de manutenção</p>
        <h1 style="margin:0;font-size:28px;color:#111827">${escapeHtml(title)}</h1>
        <p style="margin:8px 0 0;color:#64748b">Resumo para ${escapeHtml(plan.dateLabel)} · ${count} item(ns)</p>

        ${rows("OPs programadas", scheduleRows)}
        ${rows("Tarefas", taskRows)}
        ${rows("Tickets atribuídos", ticketRows)}
        ${rows("Tickets para triagem", triageRows)}

        ${
          count === 0
            ? `<p style="margin:24px 0 0;padding:14px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b">Sem trabalho atribuído para este dia.</p>`
            : ""
        }

        <p style="margin:28px 0 0">
          <a href="${escapeHtml(absoluteUrl(`/plano?date=${plan.dateValue}`))}" style="display:inline-block;background:#2dd4bf;color:#042f2e;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Abrir plano do dia</a>
        </p>
      </div>
    </div>
  `;
}

async function alreadyDelivered(prisma: PrismaClient, userId: string, date: string, channel: string) {
  const delivery = await prisma.alertDigestDelivery.findUnique({
    where: {
      userId_digestDate_channel: {
        userId,
        digestDate: date,
        channel,
      },
    },
  });

  return Boolean(delivery);
}

async function markDelivered(prisma: PrismaClient, userId: string, date: string, channel: string, subject: string) {
  await prisma.alertDigestDelivery.upsert({
    where: {
      userId_digestDate_channel: {
        userId,
        digestDate: date,
        channel,
      },
    },
    update: {
      subject,
      sentAt: new Date(),
    },
    create: {
      userId,
      digestDate: date,
      channel,
      subject,
    },
  });
}

async function sendResendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM || "Gestão de manutenção <onboarding@resend.dev>";

  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY em falta." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Erro desconhecido.");
    throw new Error(`Falha no envio de email: ${response.status} ${errorText}`);
  }

  return { sent: true };
}

export async function sendDailyPlanDigests(options: DigestOptions = {}) {
  const prisma = getPrisma();
  const dateValue = options.date || lisbonDateValue();
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "MANAGER", "USER"] } },
    orderBy: { name: "asc" },
  });
  const result = {
    date: dateValue,
    users: users.length,
    notificationsCreated: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    emptyPlans: 0,
    errors: [] as string[],
  };

  for (const user of users) {
    const plan = await buildDailyPlanData(prisma, user, {
      date: dateValue,
      userId: user.role === "ADMIN" || user.role === "MANAGER" ? "ALL" : user.id,
    });
    const total = dailyPlanCount(plan);
    const subject = `Plano do dia - ${formatDate(plan.start)}`;

    if (total === 0) {
      result.emptyPlans += 1;
    }

    const inAppDone = !options.force && (await alreadyDelivered(prisma, user.id, dateValue, "IN_APP"));
    if (!inAppDone) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: subject,
          body: total > 0 ? `${total} item(ns) no plano.` : "Sem trabalho atribuído para este dia.",
          href: `/plano?date=${dateValue}`,
        },
      });
      await markDelivered(prisma, user.id, dateValue, "IN_APP", subject);
      result.notificationsCreated += 1;
    }

    if (!isDeliverableEmail(user.email)) {
      result.emailsSkipped += 1;
      continue;
    }

    const emailDone = !options.force && (await alreadyDelivered(prisma, user.id, dateValue, "EMAIL"));
    if (emailDone) {
      result.emailsSkipped += 1;
      continue;
    }

    try {
      const emailResult = await sendResendEmail(user.email, subject, renderPlanEmail(user, plan));
      if (emailResult.sent) {
        await markDelivered(prisma, user.id, dateValue, "EMAIL", subject);
        result.emailsSent += 1;
      } else {
        result.emailsSkipped += 1;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido no envio do email.");
    }
  }

  return result;
}
