const lisbonDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
});

export function calibrationDay(date: Date) {
  return lisbonDay.format(date);
}

export function daysToCalibration(due: Date, today = new Date()) {
  return (Date.parse(calibrationDay(due)) - Date.parse(calibrationDay(today))) / 86_400_000;
}

export const calibrationGroups = ["Vencidas", "Vencem hoje", "Nos próximos 14 dias", "Entre 15 e 30 dias"];

export function calibrationGroup(days: number) {
  if (days < 0) return 0;
  if (days === 0) return 1;
  if (days <= 14) return 2;
  if (days <= 30) return 3;
  return -1;
}
