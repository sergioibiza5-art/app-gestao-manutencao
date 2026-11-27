import { sleep, RetryableError } from "workflow";
import { notifyQualityCall } from "@/lib/production-quality-email";

export async function qualityReminderWorkflow(callId: string, dueAt: Date) {
  "use workflow";
  await sleep(dueAt);
  return await sendPendingReminder(callId);
}

async function sendPendingReminder(callId: string) {
  "use step";
  const result = await notifyQualityCall(callId, undefined, { reminder: true });
  console.info("Lembrete CQ", callId, result);
  if (result.failed) throw new RetryableError("Falha no envio do lembrete CQ.", { retryAfter: "1m" });
  return result;
}
