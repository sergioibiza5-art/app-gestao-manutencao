export const qualityReminderDelayMs = 20 * 60 * 1000;

export function qualityReminderAt(calledAt: Date) {
  return new Date(calledAt.valueOf() + qualityReminderDelayMs);
}

export function qualityReminderDue(call: { calledAt: Date; arrivedAt: Date | null; endedAt: Date | null; batch: { status: string } }, now = new Date()) {
  return call.batch.status === "OPEN" && !call.arrivedAt && !call.endedAt && now >= qualityReminderAt(call.calledAt);
}
