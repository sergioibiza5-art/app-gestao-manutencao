import { createHash } from "node:crypto";

import { parseEnvironmentalWorkbookReadings, type ParsedEnvironmentalReading } from "@/lib/environmental-workbook";
import { getPrisma } from "@/lib/prisma";

function fileHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export type EnvironmentalImportSource = "MANUAL" | "GOOGLE_DRIVE" | "LOCAL_FOLDER" | "SHAREPOINT";

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
  error?: string;
};

export async function saveEnvironmentalImport(input: {
  fileName: string;
  fileHash: string;
  source?: EnvironmentalImportSource;
  sourceUrl?: string | null;
  sourceModifiedAt?: Date | null;
  readings: ParsedEnvironmentalReading[];
}): Promise<ImportEnvironmentalWorkbookResult> {
  const prisma = getPrisma();
  const existing = await prisma.environmentalImport.findUnique({ where: { fileHash: input.fileHash } });

  if (existing) {
    return {
      status: "duplicate",
      fileName: input.fileName,
      readingsCount: existing.rowsCount,
      fileHash: input.fileHash,
      importId: existing.id,
    };
  }

  if (input.readings.length === 0) {
    return {
      status: "empty",
      fileName: input.fileName,
      readingsCount: 0,
      fileHash: input.fileHash,
    };
  }

  const importRow = await prisma.$transaction(async (tx) => {
    const created = await tx.environmentalImport.create({
      data: {
        fileName: input.fileName,
        fileHash: input.fileHash,
        source: input.source ?? "MANUAL",
        sourceUrl: input.sourceUrl ?? null,
        sourceModifiedAt: input.sourceModifiedAt ?? null,
        rowsCount: input.readings.length,
      },
    });

    for (let index = 0; index < input.readings.length; index += 1000) {
      await tx.environmentalReading.createMany({
        data: input.readings.slice(index, index + 1000).map((reading) => ({
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
    readingsCount: input.readings.length,
    fileHash: input.fileHash,
    importId: importRow.id,
  };
}

export async function importEnvironmentalWorkbook(input: ImportEnvironmentalWorkbookInput): Promise<ImportEnvironmentalWorkbookResult> {
  const hash = fileHash(input.buffer);
  const readings = parseEnvironmentalWorkbookReadings(input.buffer);

  return saveEnvironmentalImport({
    fileName: input.fileName,
    fileHash: hash,
    source: input.source ?? "MANUAL",
    sourceUrl: input.sourceUrl ?? null,
    sourceModifiedAt: input.sourceModifiedAt ?? null,
    readings,
  });
}
