export const pilotCode = "MCC_1";
export const documentCode = "IMPSUP0833.02";

type PlanGroup = {
  key: string;
  label: string;
  pages: string;
  primary: "Produção" | "Manutenção";
  checks: readonly { key: string; label: string }[];
};

function group(key: string, label: string, pages: string, primary: PlanGroup["primary"], points: string[]): PlanGroup {
  return { key, label, pages, primary, checks: points.map((label, index) => ({ key: `point-${index + 1}`, label })) };
}

const hotMelterGroups = (start: number) => [
  group("daily", "Diária", String(start), "Produção", [
    "Verificar danos externos no Hot Melter.",
    "Verificar se há objetos estranhos ou contaminação no interior do tanque antes de o encher.",
    "Verificar fugas, presença de todas as peças e ajuste das ligações de encaixe e do parafuso da barra de espalhamento de cola.",
    "Remover restos de material de fusão e sujidade da barra de espalhamento.",
    "Inspecionar visualmente a mangueira para detetar fugas ou torções.",
  ]),
  group("weekly", "Semanal", String(start + 1), "Produção", [
    "Verificar se existem fugas na barra de espalhamento da cola.",
  ]),
  group("fortnightly", "A cada duas semanas", String(start + 2), "Manutenção", [
    "Verificar se há contaminação nos cartuchos de filtragem e substituir se necessário.",
  ]),
  group("monthly", "Mensal", String(start + 3), "Manutenção", [
    "Fixar o disco da caixa de empanque (acoplador) da bomba de engrenagem.",
    "Verificar o estado da proteção contra sobreaquecimento.",
    "Apertar as porcas de união dos acessórios da mangueira.",
  ]),
  group("500-hours", "A cada 500 horas", `${start + 4}–${start + 5}`, "Manutenção", [
    "Verificar o aperto dos parafusos de fixação da barra de espalhamento.",
    "Verificar se existem fugas de cola na bomba de engrenagem.",
  ]),
  group("annual", "Anual", String(start + 6), "Manutenção", [
    "Inspecionar danos visíveis na parte elétrica, como fios partidos, peças partidas ou desgaste excessivo.",
    "Verificar se o isolamento elétrico está em boas condições.",
    "Verificar se as ligações à terra estão em bom estado.",
    "Verificar as condições operacionais.",
    "Efetuar o teste de medição de corrente e tensão.",
  ]),
];

const plans: Record<string, readonly PlanGroup[]> = {
  MCC_1: [
    group("daily", "Diária", "1", "Produção", [
      "Lubrificar os discos de feltro com óleo mineral (lâmina de corte longitudinal).",
      "Lubrificar os rolos de espuma com óleo mineral (lâmina de corte transversal).",
      "Verificar se a braçadeira do cabo de terra está firme na mesa de dobragem longitudinal e ligada no ponto previsto.",
    ]),
    group("weekly", "Semanal", "2", "Produção", [
      "Verificar visualmente se existem danos nos cabos de ligação elétrica, pneumática ou hidráulica.",
    ]),
    group("monthly", "Mensal", "3", "Manutenção", [
      "Esvaziar o separador de água das unidades de manutenção pneumática.",
    ]),
    group("semiannual", "Semestral", "4–5", "Manutenção", [
      "Controlar o nível de óleo da engrenagem e mudar o óleo se necessário.",
      "Inspecionar visualmente o desgaste das correias transportadoras.",
      "Verificar o aperto dos parafusos dos conjuntos tensores.",
      "Inspecionar visualmente o desgaste da correia dentada.",
      "Verificar se as guias de corrediça se movem livremente e lubrificar se necessário.",
      "Substituir o filtro de pó do ventilador do armário de distribuição.",
    ]),
  ],
  HOT_2: hotMelterGroups(6),
  HOT_3: hotMelterGroups(13),
  ASP_2: [
    group("daily", "Diária", "20", "Produção", ["Verificar o nível do óleo."]),
    group("monthly", "Mensal", "21", "Manutenção", ["Limpar o filtro."]),
    group("annual", "Anual", "22", "Manutenção", [
      "Substituir o filtro.",
      "Apertar as ligações elétricas conforme indicado no manual.",
    ]),
    group("biennial", "De dois em dois anos", "23", "Manutenção", ["Retificar as lâminas do granulador."]),
  ],
};

export const maintenancePlanCodes = Object.keys(plans);

export function maintenancePlan(code: string | null) {
  return code && Object.hasOwn(plans, code) ? plans[code] : [];
}

export function maintenanceGroup(code: string | null, key?: string | null) {
  const groups = maintenancePlan(code);
  return groups.find((group) => group.key === key) ?? groups[0];
}
