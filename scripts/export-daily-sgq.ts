import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import { lisbonDay } from "@/lib/daily-maintenance";
import { dailyArchivePdf } from "@/lib/daily-maintenance-pdf";
import { isCleaning } from "@/lib/mcc-maintenance-plan";
import { getPrisma } from "@/lib/prisma";

function asDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

function moveDay(day: string, amount: number) {
  const date = asDate(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

const reportTypes = [{ name: "Manutencao", cleaning: false }, { name: "Limpezas", cleaning: true }];
const dailyFilename = /^(\d{4}-\d{2}-\d{2}) - (?:Manutencao|Limpezas)\.pdf$/;

function monthFolder(root: string, date: string) {
  return join(root, date.slice(0, 4), date.slice(5, 7));
}

async function fileExists(path: string) {
  return (await stat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  }))?.isFile() ?? false;
}

async function replaceFile(path: string, contents: string | Buffer, noReplace = false) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, contents, { flag: "wx" });
    if (noReplace) {
      await copyFile(temp, path, constants.COPYFILE_EXCL).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
    } else {
      await rename(temp, path);
    }
  } finally {
    await unlink(temp).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function archiveCopy(source: string, destination: string) {
  await mkdir(dirname(destination), { recursive: true });
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const [original, archived] = await Promise.all([readFile(source), readFile(destination)]);
    if (original.equals(archived)) return;
    const version = new Date().toISOString().replace(/[:.]/g, "-");
    await copyFile(source, `${destination.slice(0, -4)} - versao ${version}-${randomUUID().slice(0, 8)}.pdf`, constants.COPYFILE_EXCL);
  }
}

async function dailyReports(folder: string) {
  const files = await readdir(folder, { withFileTypes: true });
  return files.flatMap((file) => {
    const match = file.isFile() && dailyFilename.exec(file.name);
    return match ? [{ path: join(folder, file.name), day: match[1] }] : [];
  });
}

async function organiseDailyReports(output: string, obsolete: string, latestDay: string) {
  const legacy = [];
  for (const year of await readdir(output, { withFileTypes: true })) {
    if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
    const path = join(output, year.name);
    for (const month of await readdir(path, { withFileTypes: true })) {
      if (!month.isDirectory() || !/^(0[1-9]|1[0-2])$/.test(month.name)) continue;
      const reports = await dailyReports(join(path, month.name));
      legacy.push(...reports.filter(({ day }) => day.startsWith(`${year.name}-${month.name}-`)));
    }
  }
  for (const report of legacy.filter(({ day }) => day === latestDay)) {
    const target = join(output, basename(report.path));
    if (await fileExists(target)) {
      await archiveCopy(report.path, join(monthFolder(obsolete, report.day), basename(report.path)));
    } else {
      await copyFile(report.path, target, constants.COPYFILE_EXCL);
    }
    await unlink(report.path);
  }
  for (const { name } of reportTypes) {
    if (!(await fileExists(join(output, `${latestDay} - ${name}.pdf`)))) throw new Error("The latest daily reports are incomplete.");
  }
  for (const report of [...legacy, ...await dailyReports(output)]) {
    if (report.day >= latestDay) continue;
    await archiveCopy(report.path, join(monthFolder(obsolete, report.day), basename(report.path)));
    await unlink(report.path);
  }
}

async function checkpoint(path: string) {
  const raw = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (raw === null) return null;
  const state = JSON.parse(raw) as { through?: string; checkedAt?: string };
  if (!state.through || !/^\d{4}-\d{2}-\d{2}$/.test(state.through) ||
      moveDay(state.through, 0) !== state.through || !state.checkedAt ||
      !Number.isFinite(Date.parse(state.checkedAt))) {
    throw new Error("Invalid SGQ export checkpoint.");
  }
  return { through: state.through, checkedAt: new Date(state.checkedAt) };
}

async function main() {
  const { values: { output } } = parseArgs({ options: { output: { type: "string" } } });
  if (!output || !isAbsolute(output)) throw new Error("Pass an absolute folder with --output.");
  await mkdir(output, { recursive: true });
  const obsolete = join(output, "0bsoleto");
  await mkdir(obsolete, { recursive: true });
  const statePath = join(output, ".export-state.json");
  const previous = await checkpoint(statePath);
  const startedAt = new Date();
  const yesterday = moveDay(lisbonDay(startedAt), -1);
  if (previous && previous.through > yesterday) throw new Error("The export checkpoint is ahead of the local date.");
  const days = new Set<string>();
  const closingMonths = new Set<string>();
  const firstDay = previous ? moveDay(previous.through, 1) : yesterday;
  for (let day = firstDay; day <= yesterday; day = moveDay(day, 1)) {
    days.add(day);
    if (moveDay(day, 1).endsWith("-01")) closingMonths.add(day.slice(0, 7));
  }
  if (lisbonDay(startedAt).endsWith("-01")) closingMonths.add(yesterday.slice(0, 7));

  loadEnvConfig(process.cwd());
  const prisma = getPrisma();
  try {
    if (previous) {
      // Regenerate archived days when a signature or a late record is added.
      const changed = await prisma.dailyMaintenanceEntry.findMany({
        where: {
          day: { lte: asDate(previous.through) },
          OR: [{ recordedAt: { gte: previous.checkedAt } }, { verifiedAt: { gte: previous.checkedAt } }],
        },
        select: { day: true },
        distinct: ["day"],
      });
      changed.forEach(({ day }) => days.add(day.toISOString().slice(0, 10)));
    }
    function entriesBetween(first: string, next: string) {
      return prisma.dailyMaintenanceEntry.findMany({
        where: { day: { gte: asDate(first), lt: asDate(next) } },
        include: { equipment: { select: { code: true, name: true } } },
        orderBy: [{ equipment: { name: "asc" } }, { equipmentId: "asc" }, { day: "asc" }, { groupKey: "asc" }, { revision: "asc" }],
      });
    }
    for (const day of [...days].sort()) {
      const entries = await entriesBetween(day, moveDay(day, 1));
      const folder = day === yesterday ? output : monthFolder(obsolete, day);
      await mkdir(folder, { recursive: true });
      const reports = await Promise.all(reportTypes.map(async ({ name, cleaning }) => ({
        filename: `${day} - ${name}.pdf`,
        pdf: await dailyArchivePdf({ day }, cleaning, entries.filter((entry) => isCleaning(entry.groupKey) === cleaning)),
      })));
      for (const { filename, pdf } of reports) {
        const path = join(folder, filename);
        const archived = join(monthFolder(obsolete, day), filename);
        if (await fileExists(path)) {
          const versionPath = path === archived
            ? `${archived.slice(0, -4)} - versao ${randomUUID().slice(0, 8)}.pdf`
            : archived;
          await archiveCopy(path, versionPath);
        }
        await replaceFile(path, pdf);
      }
      console.log(`${day}: 2 PDFs (${entries.length} records).`);
    }
    await organiseDailyReports(output, obsolete, yesterday);
    for (const month of closingMonths) {
      const first = `${month}-01`;
      const next = asDate(first);
      next.setUTCMonth(next.getUTCMonth() + 1);
      const folder = monthFolder(output, month);
      await mkdir(folder, { recursive: true });
      const pending = [];
      for (const type of reportTypes) {
        const path = join(folder, `${month} - ${type.name} - Final.pdf`);
        if (!(await fileExists(path))) pending.push({ ...type, path });
      }
      if (!pending.length) continue;
      const entries = await entriesBetween(first, next.toISOString().slice(0, 10));
      for (const { path, cleaning } of pending) {
        const pdf = await dailyArchivePdf({ month }, cleaning, entries.filter((entry) => isCleaning(entry.groupKey) === cleaning));
        await replaceFile(path, pdf, true);
      }
      console.log(`${month}: monthly close saved.`);
    }
    await replaceFile(statePath, JSON.stringify({ through: yesterday, checkedAt: startedAt.toISOString() }));
    if (!days.size) console.log("SGQ archive already up to date.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
