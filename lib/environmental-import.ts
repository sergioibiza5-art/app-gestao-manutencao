import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

import { environmentalType, environmentalZone, simpleEnvironmentalStatus } from "@/lib/environmental";
import { getPrisma } from "@/lib/prisma";

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

function fileHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export type EnvironmentalImportSource = "MANUAL" | "GOOGLE_DRIVE";

export type ImportEnvironmentalWorkbookInput = {
  buffer: Buffer;
  fileName: string;
  source?: EnvironmentalImportSource;
  sourceUrl?: string | null;
  sourceModifiedAt?: Date | null;
};

export type ImportEnvironmentalWorkbookResult = {
  status: "imported" | "duplicate" | "empty" | "invalid";
  fileName: string;
  readingsCount: number;
  fileHash: string;
  importId?: string;
};

function parseWorkbookReadings(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
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

export async function importEnvironmentalWorkbook(input: ImportEnvironmentalWorkbookInput): Promise<ImportEnvironmentalWorkbookResult> {
  const hash = fileHash(input.buffer);
  const prisma = getPrisma();
  const existing = await prisma.environmentalImport.findUnique({ where: { fileHash: hash } });

  if (existing) {
    return {
      status: "duplicate",
      fileName: input.fileName,
      readingsCount: existing.rowsCount,
      fileHash: hash,
      importId: existing.id,
    };
  }

  const readings = parseWorkbookReadings(input.buffer);
  if (readings.length === 0) {
    return {
      status: "empty",
      fileName: input.fileName,
      readingsCount: 0,
      fileHash: hash,
    };
  }

  const importRow = await prisma.$transaction(async (tx) => {
    const created = await tx.environmentalImport.create({
      data: {
        fileName: input.fileName,
        fileHash: hash,
        source: input.source ?? "MANUAL",
        sourceUrl: input.sourceUrl ?? null,
        sourceModifiedAt: input.sourceModifiedAt ?? null,
        rowsCount: readings.length,
      },
    });

    for (let index = 0; index < readings.length; index += 1000) {
      await tx.environmentalReading.createMany({
        data: readings.slice(index, index + 1000).map((reading) => ({
          ...reading,
          importId: created.id,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return {
    status: "imported",
    fileName: input.fileName,
    readingsCount: readings.length,
    fileHash: hash,
    importId: importRow.id,
  };
}
