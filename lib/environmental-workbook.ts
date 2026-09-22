import * as XLSX from "xlsx";

import { environmentalType, environmentalZone, simpleEnvironmentalStatus } from "@/lib/environmental";

export type ParsedEnvironmentalReading = {
  timestamp: Date;
  hour: string;
  sensor: string;
  zone: string;
  type: "TEMPERATURE" | "HUMIDITY" | "PRESSURE";
  value: string;
  status: "OK" | "ALERT" | "ACTION";
};

function parsePortugueseDateTime(value: unknown, fallbackTime?: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S));
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const [datePart, timePartFromDate] = raw.split(/\s+/);
  const parts = datePart.split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;

  const timePart = timePartFromDate || String(fallbackTime ?? "").trim() || "00:00";
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);
  const [day, month, year] = parts[0] > 1900 ? [parts[2], parts[1], parts[0]] : parts;

  return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
}

function decimalFromCell(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseEnvironmentalWorkbookReadings(buffer: ArrayBuffer | Uint8Array): ParsedEnvironmentalReading[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().includes("raw")) ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => String(cell ?? "").trim().toLowerCase().includes("date")) &&
    row.some((cell) => environmentalType(String(cell ?? ""))),
  );

  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map((cell) => String(cell ?? "").trim());
  const dateIndex = headers.findIndex((header) => header.toLowerCase().includes("date"));
  const timeIndex = headers.findIndex((header) => header.toLowerCase() === "hora" || header.toLowerCase().includes("time"));
  const sensorColumns = headers
    .map((header, index) => {
      const type = environmentalType(header);
      const zone = environmentalZone(header, type);
      return { header, index, type, zone };
    })
    .filter((column): column is { header: string; index: number; type: "TEMPERATURE" | "HUMIDITY" | "PRESSURE"; zone: string } => Boolean(column.type && column.zone));

  return rows.slice(headerIndex + 1).flatMap((row) => {
    const timestamp = parsePortugueseDateTime(row[dateIndex], timeIndex >= 0 ? row[timeIndex] : undefined);
    if (!timestamp) return [];

    return sensorColumns.flatMap((column) => {
      const value = decimalFromCell(row[column.index]);
      if (value === null) return [];

      return {
        timestamp,
        hour: timestamp.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", hour12: false }),
        sensor: column.header,
        zone: column.zone,
        type: column.type,
        value: value.toFixed(2),
        status: simpleEnvironmentalStatus(column.type, value),
      };
    });
  });
}
