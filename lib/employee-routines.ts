import type { UserRole } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { biennialDueDate, currentMaintenancePeriods, dailyEntryStatus, dailyMaintenanceUnits, dailyPath } from "@/lib/daily-maintenance";
import { isCleaning, maintenancePlan } from "@/lib/mcc-maintenance-plan";
import { maintenanceMeterState } from "@/lib/maintenance-meter";

export type RoutineState = "pending" | "done" | "no-production" | "verify" | "issue" | "reading" | "not-due";
export function routineStatus(entry: { noProduction: boolean; failed: boolean; verified: boolean } | null, cleaning: boolean, due = false): { state: RoutineState; label: string } {
  if (!entry || due) return { state: "pending", label: "Por fazer" };
  if (entry.noProduction) return { state: "no-production", label: "Sem produção" };
  if (entry.failed) return { state: "issue", label: "Com não conformidade" };
  if (cleaning && !entry.verified) return { state: "verify", label: "Executada · Por verificar" };
  return { state: "done", label: cleaning ? "Concluída · Verificada" : "Concluído" };
}

export async function getEmployeeRoutines(person: { id: string; role: UserRole }, today: string) {
  const db = getPrisma();
  if (!["TICKET", "USER"].includes(person.role) || !await db.ticketEquipmentAccess.count({ where: { userId: person.id } })) return [];
  const units = await dailyMaintenanceUnits(person);
  const byId = new Map(units.map(unit => [unit.id, unit]));
  return Promise.all(units.map(async equipment => {
    const groups = maintenancePlan(equipment.code);
    const entries = await currentMaintenancePeriods(equipment.id, groups.map(g => g.key), today);
    let root = equipment;
    const seen = new Set([root.id]);
    while (root.parentEquipmentId && byId.has(root.parentEquipmentId) && !seen.has(root.parentEquipmentId)) {
      root = byId.get(root.parentEquipmentId)!;
      seen.add(root.id);
    }
    const tasks = await Promise.all(groups.map(async group => {
      const entry = entries.get(group.key);
      const cleaning = isCleaning(group.key);
      const biennialDue = group.key === "biennial" && !!entry && biennialDueDate(entry.day).toISOString().slice(0, 10) <= today;
      let status = routineStatus(entry ? { noProduction: entry.noProduction, failed: dailyEntryStatus(entry) === "Verificação com falhas", verified: !!entry.verifiedAt } : null, cleaning, biennialDue);
      let period = group.key.endsWith("daily") ? "Hoje" : "Período atual";
      if (status.state === "pending") status.label = group.key.endsWith("daily") ? "Por fazer hoje" : "Por fazer neste período";
      if (group.intervalHours) {
        period = "Horímetro";
        const meter = await maintenanceMeterState(db, equipment.id, group.key, group.intervalHours, group.firstHours);
        status = !meter.current || !meter.next ? { state: "reading", label: !meter.current ? "Falta leitura do horímetro" : "Falta referência de manutenção" }
          : meter.current.gte(meter.next) ? { state: "pending", label: `Intervenção devida · ${meter.next.toString()} h` }
          : { state: "not-due", label: `Faltam ${meter.next.minus(meter.current).toString()} h` };
      }
      return { key: group.key, label: `${cleaning ? "Limpeza" : "Preventiva"} · ${group.label}`, primary: group.primary, period, state: status.state, statusLabel: status.label,
        href: `${dailyPath(equipment.id)}?grupo=${group.key}`, cleaning };
    }));
    return { equipment, rootId: root.id, rootName: root.name, rootCode: root.code, tasks };
  }));
}
