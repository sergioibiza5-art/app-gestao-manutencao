import { start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { getPrisma } from "@/lib/prisma";
import { qualityReminderAt } from "@/lib/quality-reminder";
import { qualityReminderWorkflow } from "@/workflows/quality-reminder";

export async function scheduleQualityReminder(callId: string) {
  const call = await getPrisma().productionQualityCall.findUnique({ where: { id: callId }, include: { batch: { select: { status: true } } } });
  if (!call || call.arrivedAt || call.endedAt || call.batch.status !== "OPEN") return null;
  try {
    const run = await start(qualityReminderWorkflow, [call.id, qualityReminderAt(call.calledAt)], {
      experimental_hook: { token: `quality-reminder:${call.id}` },
    });
    console.info("Lembrete CQ agendado", callId, run.runId);
    return run.runId;
  } catch (error) {
    if (HookConflictError.is(error)) return error.conflictingRunId;
    throw error;
  }
}
