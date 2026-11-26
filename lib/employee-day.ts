import { formatLisbonDateTimeInput, parseLisbonDateTimeInput } from "@/lib/lisbon-time";
import { stopMinutes } from "@/lib/production";

export function employeeHome(role: string) {
  return ["USER", "TICKET", "SGQ"].includes(role) ? "/funcionario" : role === "HSA" ? "/calibracao" : "/";
}

export function canViewEmployee(viewer: { id: string; productionCoordinator: boolean }, id: string) {
  return viewer.id === id || viewer.productionCoordinator;
}

export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function employeeDayWindow(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Dia inválido.");
  const start = parseLisbonDateTimeInput(`${day}T00:00`);
  if (!start || formatLisbonDateTimeInput(start).slice(0, 10) !== day) throw new Error("Dia inválido.");
  const end = parseLisbonDateTimeInput(`${shiftDay(day, 1)}T00:00`)!;
  return { start, end };
}

export type DayPeriod = { start: Date; end: Date | null; kind: "production" | "quality" };

export function clipDayPeriod(period: DayPeriod, window: { start: Date; end: Date }, now: Date) {
  const start = new Date(Math.max(period.start.getTime(), window.start.getTime()));
  const end = new Date(Math.min((period.end ?? now).getTime(), window.end.getTime(), now.getTime()));
  return end > start ? { start, end } : null;
}

export function employeeDayTotals(periods: DayPeriod[], window: { start: Date; end: Date }, now: Date) {
  const clipped = periods.flatMap(period => {
    const interval = clipDayPeriod(period, window, now);
    return interval ? [{ ...interval, kind: period.kind, closed: !!period.end }] : [];
  });
  const total = stopMinutes(clipped, now);
  const closed = stopMinutes(clipped.filter(p => p.closed), now);
  const sum = clipped.reduce((n, p) => n + (p.end.getTime() - p.start.getTime()) / 60000, 0);
  return {
    total, closed, provisional: total - closed,
    production: stopMinutes(clipped.filter(p => p.kind === "production"), now),
    quality: stopMinutes(clipped.filter(p => p.kind === "quality"), now),
    overlap: sum > total + 1 / 60,
  };
}
