import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileSpreadsheet,
  Filter,
  Plus,
  Ruler,
  Search,
  Settings,
  X,
} from "lucide-react";

import { createEquipment, importEquipmentCsv } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import {
  buttonClass,
  EmptyState,
  inputClass,
  PageHeader,
  Panel,
  textareaClass,
} from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type EquipmentPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    location?: string;
    category?: string;
    typeId?: string;
    measurement?: string;
    page?: string;
  }>;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function FrequencySelect({ name }: { name: string }) {
  return (
    <select name={name} className={inputClass}>
      <option value="MONTHLY">Mensal</option>
      <option value="QUARTERLY">Trimestral</option>
      <option value="FOUR_MONTHLY">Quadrimestral</option>
      <option value="SEMIANNUAL">Semestral</option>
      <option value="ANNUAL">Anual</option>
      <option value="WEEKLY">Semanal</option>
      <option value="DAILY">Diária</option>
    </select>
  );
}

function InterventionPlanFields({
  prefix,
  title,
  description,
}: {
  prefix: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
      <div className="flex items-start gap-3">
        <input
          id={`${prefix}Enabled`}
          name={`${prefix}Enabled`}
          value="true"
          type="checkbox"
          className="mt-1 size-4 accent-teal-300"
        />

        <div className="min-w-0 flex-1">
          <label htmlFor={`${prefix}Enabled`} className="font-medium text-zinc-100">
            {title}
          </label>
          <p className="mt-1 text-sm leading-5 text-zinc-500">{description}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[0.45fr_1fr]">
        <FrequencySelect name={`${prefix}Frequency`} />
        <textarea name={`${prefix}Actions`} className={textareaClass} placeholder="Ações a realizar" />
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    MAINTENANCE: "Manutenção",
    INACTIVE: "Inativo",
    DISCARDED: "Abatido",
  };

  return labels[status] ?? status;
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    ACTIVE: "bg-teal-300/10 text-teal-200",
    MAINTENANCE: "bg-amber-300/10 text-amber-200",
    INACTIVE: "bg-zinc-700/40 text-zinc-300",
    DISCARDED: "bg-red-500/10 text-red-200",
  };

  return classes[status] ?? "bg-zinc-800 text-zinc-300";
}

function pageUrl(page: number, params: Record<string, string>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") search.set(key, value);
  });

  if (page > 1) search.set("page", String(page));

  const query = search.toString();
  return query ? `/equipamentos?${query}` : "/equipamentos";
}

export default async function EquipmentPage({ searchParams }: EquipmentPageProps) {
  const params = (await searchParams) ?? {};
  const { equipment, equipmentTypes } = await getModuleData();

  const q = normalize(params.q);
  const status = params.status || "all";
  const location = params.location || "all";
  const category = params.category || "all";
  const typeId = params.typeId || "all";
  const measurement = params.measurement || "all";
  const currentPage = Math.max(Number(params.page || 1), 1);
  const pageSize = 25;
  const templateHref =
    "data:text/csv;charset=utf-8," +
    encodeURIComponent("nome;codigo_interno;data_aquisicao;fornecedor;localizacao;departamento;marca;modelo;numero_serie;medicao_monitorizacao;categoria\nCompressor 1;COMP-01;2026-01-10;Fornecedor;Sala tecnica;Manutencao;Marca;Modelo;SN001;nao;Infraestrutura\n");

  const locations = Array.from(
    new Set(equipment.map((item) => item.location).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, "pt"));

  const categories = Array.from(
    new Set(equipment.map((item) => item.category).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, "pt"));

  const filteredEquipment = equipment.filter((item) => {
    const haystack = [
      item.name,
      item.code,
      item.category,
      item.brand,
      item.model,
      item.serialNumber,
      item.supplier,
      item.location,
      item.responsibleDepartment,
      item.status,
      item.equipmentType?.name,
      item.notes,
    ]
      .map(normalize)
      .join(" ");

    return (
      (!q || haystack.includes(q)) &&
      (status === "all" || item.status === status) &&
      (location === "all" || item.location === location) &&
      (category === "all" || item.category === category) &&
      (typeId === "all" || item.equipmentTypeId === typeId) &&
      (measurement === "all" ||
        (measurement === "true" && item.isMeasurementMonitoring) ||
        (measurement === "false" && !item.isMeasurementMonitoring))
    );
  });

  const totalPages = Math.max(Math.ceil(filteredEquipment.length / pageSize), 1);
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEquipment = filteredEquipment.slice((safePage - 1) * pageSize, safePage * pageSize);

  const activeCount = equipment.filter((item) => item.status === "ACTIVE").length;
  const maintenanceCount = equipment.filter((item) => item.status === "MAINTENANCE").length;
  const measurementCount = equipment.filter((item) => item.isMeasurementMonitoring).length;

  const filterParams = {
    q: params.q || "",
    status,
    location,
    category,
    typeId,
    measurement,
  };

  return (
    <AppShell activeHref="/equipamentos">
      <PageHeader
        eyebrow="Cadastro"
        title="Equipamentos"
        description="Gestão rápida de equipamentos com pesquisa, filtros e tabela compacta para grandes volumes."
        action={
          <a href="#novo-equipamento" className={buttonClass}>
            <Plus size={18} />
            Novo equipamento
          </a>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Panel>
          <p className="text-sm text-zinc-500">Total</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-50">{equipment.length}</p>
        </Panel>

        <Panel>
          <p className="text-sm text-zinc-500">Ativos</p>
          <p className="mt-2 text-3xl font-semibold text-teal-200">{activeCount}</p>
        </Panel>

        <Panel>
          <p className="text-sm text-zinc-500">Em manutenção</p>
          <p className="mt-2 text-3xl font-semibold text-amber-200">{maintenanceCount}</p>
        </Panel>

        <Panel>
          <p className="text-sm text-zinc-500">Medição / monitorização</p>
          <p className="mt-2 text-3xl font-semibold text-lime-200">{measurementCount}</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-3">
              <Filter size={21} className="text-teal-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Filtros</h2>
            </div>

            <form className="mt-4 space-y-3">
              <div className="relative">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  name="q"
                  defaultValue={params.q ?? ""}
                  className={`${inputClass} pl-9`}
                  placeholder="Pesquisar por código, nome, modelo..."
                />
              </div>

              <select name="status" defaultValue={status} className={inputClass}>
                <option value="all">Todos os estados</option>
                <option value="ACTIVE">Ativo</option>
                <option value="MAINTENANCE">Em manutenção</option>
                <option value="INACTIVE">Inativo</option>
                <option value="DISCARDED">Abatido</option>
              </select>

              <select name="location" defaultValue={location} className={inputClass}>
                <option value="all">Todas as localizações</option>
                {locations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select name="category" defaultValue={category} className={inputClass}>
                <option value="all">Todas as categorias</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select name="typeId" defaultValue={typeId} className={inputClass}>
                <option value="all">Todos os tipos/checklists</option>
                {equipmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>

              <select name="measurement" defaultValue={measurement} className={inputClass}>
                <option value="all">Todos</option>
                <option value="true">Só medição/monitorização</option>
                <option value="false">Sem medição/monitorização</option>
              </select>

              <div className="grid grid-cols-2 gap-3">
                <button className={buttonClass}>Aplicar</button>

                <Link
                  href="/equipamentos"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50"
                >
                  <X size={16} />
                  Limpar
                </Link>
              </div>
            </form>
          </Panel>

          <div id="novo-equipamento">
            <Panel>
            <div className="flex items-center gap-3">
              <Settings size={22} className="text-orange-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Novo equipamento</h2>
            </div>

            <form action={createEquipment} className="mt-4 space-y-4">
              <div className="grid gap-3">
                <input name="name" required className={inputClass} placeholder="Nome do equipamento" />
                <input name="code" className={inputClass} placeholder="Código interno" />
                <input name="purchaseDate" type="date" className={inputClass} />
                <input name="supplier" className={inputClass} placeholder="Fornecedor" />
                <input name="location" className={inputClass} placeholder="Localização" />
                <input name="responsibleDepartment" className={inputClass} placeholder="Dep. responsável" />
                <input name="brand" className={inputClass} placeholder="Fabricante / Marca" />
                <input name="model" className={inputClass} placeholder="Modelo" />
                <input name="serialNumber" className={inputClass} placeholder="N.º de série" />

                <select name="equipmentTypeId" className={inputClass}>
                  <option value="">Sem tipo/checklist associado</option>
                  {equipmentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>

                <select name="parentEquipmentId" className={inputClass}>
                  <option value="">Sem equipamento-pai</option>
                  {equipment.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.code ? ` - ${item.code}` : ""}
                    </option>
                  ))}
                </select>

                <select name="isMeasurementMonitoring" className={inputClass}>
                  <option value="false">Não é equipamento de medição/monitorização</option>
                  <option value="true">É equipamento de medição/monitorização</option>
                </select>

                <input name="category" className={inputClass} placeholder="Categoria" />

                <select name="status" className={inputClass}>
                  <option value="ACTIVE">Ativo</option>
                  <option value="MAINTENANCE">Em manutenção</option>
                  <option value="INACTIVE">Inativo</option>
                  <option value="DISCARDED">Abatido</option>
                </select>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList size={19} className="text-teal-300" />
                  <h3 className="font-semibold text-zinc-100">Intervenções previstas</h3>
                </div>

                <div className="grid gap-3">
                  <InterventionPlanFields
                    prefix="inspectionInternal"
                    title="Inspeção interna"
                    description="Verificação feita pela equipa interna."
                  />
                  <InterventionPlanFields
                    prefix="inspectionExternal"
                    title="Inspeção externa"
                    description="Verificação feita por entidade ou fornecedor externo."
                  />
                  <InterventionPlanFields
                    prefix="maintenanceInternal"
                    title="Manutenção interna"
                    description="Manutenção executada pela equipa interna."
                  />
                  <InterventionPlanFields
                    prefix="maintenanceExternal"
                    title="Manutenção externa"
                    description="Manutenção executada por fornecedor externo."
                  />
                </div>
              </div>

              <textarea name="notes" className={textareaClass} placeholder="Notas gerais do equipamento" />
              <button className={buttonClass}>Guardar equipamento</button>
            </form>
            <div className="mt-6 rounded-lg border border-zinc-800 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} className="text-lime-300" />
                <h3 className="font-semibold text-zinc-100">Importar por Excel/CSV</h3>
              </div>
              <a href={templateHref} download="modelo_equipamentos.csv" className="mt-3 inline-flex text-sm font-semibold text-lime-200">
                Descarregar modelo
              </a>
              <form action={importEquipmentCsv} encType="multipart/form-data" className="mt-3 grid gap-3">
                <input name="file" type="file" accept=".csv,text/csv" className={inputClass} />
                <button className={buttonClass}>Importar equipamentos</button>
              </form>
            </div>
          </Panel>
        </div>
      </div>

        <Panel className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Equipamentos</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {filteredEquipment.length} resultado(s) · página {safePage} de {totalPages}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
            {paginatedEquipment.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Sem equipamentos encontrados"
                  description="Não existem equipamentos com os filtros selecionados."
                />
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[120px_minmax(220px,1fr)_150px_130px_130px_110px] border-b border-zinc-800 bg-black/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 xl:grid">
                  <div>Código</div>
                  <div>Equipamento</div>
                  <div>Local</div>
                  <div>Categoria</div>
                  <div>Estado</div>
                  <div></div>
                </div>

                <div className="divide-y divide-zinc-800">
                  {paginatedEquipment.map((item) => (
                    <Link
                      key={item.id}
                      href={`/equipamentos/${item.id}`}
                      className="block p-4 transition hover:bg-zinc-900/70 xl:grid xl:grid-cols-[120px_minmax(220px,1fr)_150px_130px_130px_110px] xl:items-center"
                    >
                      <div>
                        <p className="font-semibold text-zinc-100">{item.code ?? "—"}</p>
                        <p className="mt-1 text-xs text-zinc-600 xl:hidden">
                          Aquisição: {formatDate(item.purchaseDate)}
                        </p>
                      </div>

                      <div className="mt-3 min-w-0 xl:mt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-zinc-50">{item.name}</p>
                          {item.isMeasurementMonitoring && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-lime-300/10 px-2 py-1 text-xs text-lime-200">
                              <Ruler size={13} />
                              medição
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-zinc-500">
                          {item.equipmentType?.name ?? "sem tipo"} · {item.model ?? "sem modelo"}
                        </p>
                      </div>

                      <div className="mt-3 text-sm text-zinc-400 xl:mt-0">
                        {item.location ?? "Sem local"}
                      </div>

                      <div className="mt-3 text-sm text-zinc-400 xl:mt-0">
                        {item.category ?? "Sem categoria"}
                      </div>

                      <div className="mt-3 xl:mt-0">
                        <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-sm font-medium text-teal-300 xl:mt-0 xl:justify-end">
                        Abrir ficha
                        <ArrowRight size={16} />
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Link
                href={pageUrl(Math.max(safePage - 1, 1), filterParams)}
                className={`inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-4 text-sm font-semibold ${
                  safePage === 1
                    ? "pointer-events-none opacity-40"
                    : "bg-zinc-950 text-zinc-100 hover:border-teal-300/50"
                }`}
              >
                Anterior
              </Link>

              <p className="text-sm text-zinc-500">
                {safePage} / {totalPages}
              </p>

              <Link
                href={pageUrl(Math.min(safePage + 1, totalPages), filterParams)}
                className={`inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-4 text-sm font-semibold ${
                  safePage === totalPages
                    ? "pointer-events-none opacity-40"
                    : "bg-zinc-950 text-zinc-100 hover:border-teal-300/50"
                }`}
              >
                Seguinte
              </Link>
            </div>
          )}
        </Panel>
      </section>
    </AppShell>
  );
}
