import { lisbonDate } from "./chemical-report-utils";

function moveDay(date: Date, amount: number) {
  return new Date(date.valueOf() + amount * 86_400_000).toISOString().slice(0, 10);
}

export function portugueseHolidays(year: number) {
  // Gregorian Easter (Meeus/Jones/Butcher); movable national holidays follow it.
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  const easter = new Date(Date.UTC(year, month - 1, day));
  // Article 234, https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475-46746675
  return new Set([
    ...["01-01", "04-25", "05-01", "06-10", "08-15", "10-05", "11-01", "12-01", "12-08", "12-25"].map(day => `${year}-${day}`),
    moveDay(easter, -2), moveDay(easter, 0), moveDay(easter, 60),
  ]);
}

export function firstBusinessDay(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido.");
  const date = new Date(`${month}-01T00:00:00Z`);
  const holidays = portugueseHolidays(date.getUTCFullYear());
  while ([0, 6].includes(date.getUTCDay()) || holidays.has(date.toISOString().slice(0, 10))) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

export function chemicalMonth(month: string) {
  firstBusinessDay(month);
  const [year, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  // Month boundaries never coincide with Lisbon's last-Sunday DST transitions.
  const midnight = (day: string) => {
    const noon = new Date(`${day}T12:00:00Z`);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(noon));
    return new Date(new Date(`${day}T00:00:00Z`).valueOf() - (hour - 12) * 3_600_000);
  };
  return { month, start, end, from: midnight(start), until: midnight(next) };
}

export function monthlyChemicalSchedule(now = new Date()) {
  const today = lisbonDate(now);
  const date = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCDate(0);
  const period = chemicalMonth(date.toISOString().slice(0, 7));
  const dueDate = firstBusinessDay(today.slice(0, 7));
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(now));
  return { ...period, today, dueDate, due: today >= dueDate && hour >= 8 };
}
