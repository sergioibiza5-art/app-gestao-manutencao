const LISBON_TIME_ZONE = "Europe/Lisbon";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISBON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function timeZoneOffsetMs(date: Date) {
  const parts = zonedParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function parseLisbonDateTimeInput(value: string | null | undefined) {
  if (!value) return null;

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "00"] = match;
  const utcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const firstOffset = timeZoneOffsetMs(new Date(utcGuess));
  const firstCandidate = new Date(utcGuess - firstOffset);
  const finalOffset = timeZoneOffsetMs(firstCandidate);
  const parsed = new Date(utcGuess - finalOffset);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLisbonDateTimeInput(date: Date | null | undefined) {
  if (!date) return "";

  const parts = zonedParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

