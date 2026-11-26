import { formatLisbonDateTimeInput, parseLisbonDateTimeInput } from "@/lib/lisbon-time";

export const productionOperations = {
  PCAM: "Produção de campos", PMAS: "Produção de máscaras", PTOU: "Produção de toucas",
  PCS: "Produção de cobre-sapatos", EMB: "Embalamento", SET: "Setup de máquina",
  AJM: "Ajuste de máquina", MANT: "Manutenção", LIMP: "Limpeza", TMP: "Troca de matéria-prima", OUT: "Outra",
} as const;
export const productionStatuses = { OPEN: "Em curso", DONE: "Terminado", VERIFIED: "Conferido" } as const;
export const canManageProduction = (user: { productionCoordinator: boolean }) => user.productionCoordinator;
export const canWriteProduction = (role: string) => ["ADMIN", "MANAGER", "USER", "TICKET", "SGQ"].includes(role);

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
  const minutes = Math.round(value);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
