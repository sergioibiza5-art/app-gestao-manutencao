type MaintenanceFrequency =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "FOUR_MONTHLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "BIENNIAL"
  | "FIVE_YEAR";

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function addMonthsClamped(date: Date, months: number) {
  const value = new Date(date);
  const day = value.getDate();

  value.setDate(1);
  value.setMonth(value.getMonth() + months);

  const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  value.setDate(Math.min(day, lastDay));

  return value;
}

export function maintenanceToleranceEnd(scheduledAt: Date, frequency: string | null | undefined) {
  const scheduled = endOfDay(scheduledAt);

  switch (frequency as MaintenanceFrequency) {
    case "MONTHLY":
      return endOfDay(addDays(scheduled, 7));
    case "QUARTERLY":
    case "FOUR_MONTHLY":
    case "SEMIANNUAL":
    case "BIENNIAL":
      return endOfDay(addMonthsClamped(scheduled, 1));
    case "ANNUAL":
    case "FIVE_YEAR":
      return endOfDay(addMonthsClamped(scheduled, 2));
    default:
      return scheduled;
  }
}

export function isMaintenanceOutsideTolerance(
  scheduledAt: Date,
  frequency: string | null | undefined,
  referenceDate: Date = new Date(),
) {
  return startOfDay(referenceDate).getTime() > maintenanceToleranceEnd(scheduledAt, frequency).getTime();
}

export function isMaintenanceWithinTolerance(
  scheduledAt: Date,
  frequency: string | null | undefined,
  referenceDate: Date = new Date(),
) {
  const reference = startOfDay(referenceDate);
  const scheduled = startOfDay(scheduledAt);

  return reference.getTime() >= scheduled.getTime() && reference.getTime() <= maintenanceToleranceEnd(scheduledAt, frequency).getTime();
}

