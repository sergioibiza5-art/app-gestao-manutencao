import { formatLisbonDateTimeInput, parseLisbonDateTimeInput } from "@/lib/lisbon-time";

export const productionOperations = {
  PCAM: "Produção de campos", PMAS: "Produção de máscaras", PTOU: "Produção de toucas",
  PCS: "Produção de cobre-sapatos", EMB: "Embalamento", SET: "Setup de máquina",
  AJM: "Ajuste de máquina", MANT: "Manutenção", LIMP: "Limpeza", TMP: "Troca de matéria-prima", OUT: "Outra",
} as const;
export const productionStatuses = { PLANNED: "Por iniciar", OPEN: "Em curso", DONE: "Terminado", VERIFIED: "Conferido" } as const;

export function batchButtonStatus(status: string, command: "batch-start" | "batch-end") {
  if (command === "batch-start") {
    if (status !== "PLANNED") throw new Error("Só podes iniciar um lote que esteja por iniciar.");
    return "OPEN";
  }
  if (status !== "OPEN") throw new Error("Só podes terminar um lote em curso.");
  return "DONE";
}
export const canManageProduction = (user: { productionCoordinator: boolean }) => user.productionCoordinator;
export const canExecuteQuality = (user: { role: string; qualityExecutor: boolean }) => user.role === "SGQ" && user.qualityExecutor;
export const canWriteProduction = (role: string) => ["ADMIN", "MANAGER", "USER", "TICKET", "SGQ"].includes(role);

export function productionWasteQuantity(value: string) {
  const quantity = value.trim().replace(",", ".");
  if (!/^\d{1,11}(\.\d{1,3})?$/.test(quantity)) throw new Error("Quantidade final de desperdício inválida. Indica zero ou um valor positivo, com até três casas decimais.");
  return quantity;
}

export function productionDate(value: string, required = false) {
  if (!value && !required) return null;
  const date = parseLisbonDateTimeInput(value);
  if (!date || formatLisbonDateTimeInput(date) !== value.slice(0, 16)) throw new Error("Data ou hora inválida (hora de Lisboa).");
  if (date.getTime() > Date.now() + 60_000) throw new Error("Não podes registar uma atividade no futuro.");
  return date;
}

export function validateInterval(start: Date, end: Date | null) {
  if (end && end <= start) throw new Error("A hora de fim tem de ser posterior à hora de início.");
}

export type QualityTimes = {
  calledAt: Date; arrivedAt: Date | null; endedAt: Date | null; technicianId: string | null;
  hasStop: boolean; stopStartedAt: Date | null; stopEndedAt: Date | null;
};
export function validateQuality(value: QualityTimes) {
  if (value.arrivedAt && value.arrivedAt < value.calledAt) throw new Error("A chegada não pode ser anterior à chamada.");
  if (value.arrivedAt && !value.technicianId) throw new Error("Identifica o técnico que realizou o controlo.");
  if (value.endedAt && !value.arrivedAt) throw new Error("Indica a chegada antes de terminar o controlo.");
  if (value.arrivedAt) validateInterval(value.arrivedAt, value.endedAt);
  if (value.hasStop) {
    if (!value.stopStartedAt) throw new Error("Indica o início da paragem.");
    validateInterval(value.stopStartedAt, value.stopEndedAt);
  } else if (value.stopStartedAt || value.stopEndedAt) throw new Error("Sem paragem, os horários de paragem devem ficar vazios.");
}

export function elapsedMinutes(start: Date, end: Date | null, now = new Date()) {
  return Math.max(0, ((end ?? now).getTime() - start.getTime()) / 60_000);
}

// Overlapping equipment stops are counted once, not once per operator or CQ request.
export function stopMinutes(intervals: { start: Date; end: Date | null }[], now = new Date()) {
  const sorted = intervals.map(x => [x.start.getTime(), (x.end ?? now).getTime()]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let total = 0, end = -Infinity;
  for (const [a, b] of sorted) { total += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
  return total / 60_000;
}

export function minutesLabel(value: number) {
  const seconds = Math.max(0, Math.round(value * 60));
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
}

type Person = { name: string; username?: string | null };
type PersonActivity = { collaboratorId: string; collaborator: Person; startedAt: Date; endedAt: Date | null };
type PersonQuality = { technicianId: string | null; technician: Person | null; arrivedAt: Date | null; endedAt: Date | null };

export function productionPeopleSummary(activities: PersonActivity[], quality: PersonQuality[], now = new Date()) {
  const people = new Map<string, { id: string; name: string; username: string | null; startedAt: Date; endedAt: Date | null; open: boolean; operatorMinutes: number; qualityMinutes: number; totalMinutes: number; sessions: number }>();
  function add(id: string, person: Person, start: Date, end: Date | null, kind: "operatorMinutes" | "qualityMinutes") {
    const row = people.get(id) ?? { id, name: person.name, username: person.username ?? null, startedAt: start, endedAt: end, open: false, operatorMinutes: 0, qualityMinutes: 0, totalMinutes: 0, sessions: 0 };
    if (start < row.startedAt) row.startedAt = start;
    if (end && (!row.endedAt || end > row.endedAt)) row.endedAt = end;
    if (!end) row.open = true;
    row[kind] += elapsedMinutes(start, end, now);
    row.totalMinutes = row.operatorMinutes + row.qualityMinutes;
    row.sessions++;
    people.set(id, row);
  }
  for (const a of activities) add(a.collaboratorId, a.collaborator, a.startedAt, a.endedAt, "operatorMinutes");
  for (const q of quality) if (q.technicianId && q.technician && q.arrivedAt) add(q.technicianId, q.technician, q.arrivedAt, q.endedAt, "qualityMinutes");
  const rows = [...people.values()].map(row => ({ ...row, endedAt: row.open ? null : row.endedAt })).sort((a, b) => a.name.localeCompare(b.name, "pt") || a.id.localeCompare(b.id));
  return { rows, totalMinutes: rows.reduce((sum, row) => sum + row.totalMinutes, 0) };
}

export function productionBatchMinutes(batch: { status: string; startedAt: Date | null; endedAt: Date | null }, now = new Date()) {
  if (!batch.startedAt || (["DONE", "VERIFIED"].includes(batch.status) && !batch.endedAt)) return null;
  return elapsedMinutes(batch.startedAt, batch.endedAt, now);
}
