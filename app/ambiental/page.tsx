import { AlertTriangle, Download, FileSpreadsheet, Leaf, Search, Trash2 } from "lucide-react";

import { deleteEnvironmentalImport, importEnvironmentalReport, syncEnvironmentalFolder, updateEnvironmentalSettings } from "@/app/actions";
import { Cloud, FolderSync } from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { DetailsModal } from "@/app/components/details-modal";
import { ModuleCodificationField } from "@/app/components/module-codification-field";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { EnvironmentalFolderImporter } from "@/app/ambiental/environmental-folder-importer";
import { getEnvironmentalData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type EnvironmentalPageProps = {
  searchParams?: Promise<{
    days?: string;
    type?: string;
    zone?: string;
    status?: string;
    importId?: string;
    importError?: string;
    imported?: string;
    duplicates?: string;
    empty?: string;
    invalid?: string;
    folderSync?: string;
    folderError?: string;
    checked?: string;
    processed?: string;
    skipped?: string;
    remaining?: string;
  }>;
};

type Status = "OK" | "ALERT" | "ACTION" | string;

type EnvironmentalRow = {
  zone: string;
  type: string;
  average: number;
  min: number;
  max: number;
  occurrences: number;
  events: number;
  status: string;
  count: number;
  alertReadingsCount?: number;
  lowPressureOccurrences?: number;
  events40min?: number;
  ignoreLowPressure?: boolean;
  label?: string;
};

type EnvironmentalEventRow = {
  zone: string;
  pressureEvents40min: number;
  temperatureEvents24h: number;
  humidityEvents24h: number;
};

type EnvironmentalActionEvent = {
  zone: string;
  type: string;
  label: string;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  min: number;
  max: number;
  readingsCount: number;
  limit: string;
};

type EnvironmentalSettings = {
  alertStartTime: string;
  alertEndTime: string;
  includeSaturday: boolean;
  includeSunday: boolean;
  sharePointFolderUrl?: string | null;
  googleDriveFolderId?: string | null;
  googleDriveFolderUrl?: string | null;
};

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function statusClass(status: Status) {
  if (status === "ACTION") return "border-rose-300/40 bg-rose-300/10 text-rose-100";
  if (status === "ALERT") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
}

function statusLabel(status: Status) {
  if (status === "ACTION") return "Ação";
  if (status === "ALERT") return "Alerta";
  return "OK";
}

function unit(type: string) {
  if (type === "TEMPERATURE") return "C";
  if (type === "HUMIDITY") return "%";
  return "Pa";
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function ReadingTable({
  title,
  description,
  rows,
  type,
}: {
  title: string;
  description: string;
  rows: Array<{
    zone: string;
    type: string;
    average: number;
    min: number;
    max: number;
    occurrences: number;
    events: number;
    status: string;
    count: number;
    alertReadingsCount?: number;
  }>;
  type: "TEMPERATURE" | "HUMIDITY";
}) {
  return (
    <Panel>
      <SectionTitle title={title} description={description} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-3 py-2">Sala</th>
              <th className="px-3 py-2">Media</th>
              <th className="px-3 py-2">Minimo</th>
              <th className="px-3 py-2">Maximo</th>
              <th className="px-3 py-2">Alertas</th>
              <th className="px-3 py-2">Acoes</th>
              <th className="px-3 py-2">Leituras alerta</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((row) => (
              <tr key={`${type}-${row.zone}`} className="text-zinc-200">
                <td className="px-3 py-3 font-semibold text-zinc-50">{row.zone}</td>
                <td className="px-3 py-3">{formatNumber(row.average)} {unit(type)}</td>
                <td className="px-3 py-3">{formatNumber(row.min)} {unit(type)}</td>
                <td className="px-3 py-3">{formatNumber(row.max)} {unit(type)}</td>
                <td className="px-3 py-3 text-amber-200">{row.occurrences}</td>
                <td className="px-3 py-3 text-rose-200">{row.events}</td>
                <td className="px-3 py-3">{row.alertReadingsCount ?? 0}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                    {row.count === 0 ? "Sem dados" : statusLabel(row.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default async function EnvironmentalPage({ searchParams }: EnvironmentalPageProps) {
  const params = (await searchParams) ?? {};
  const days = params.days || "7";
  const type = params.type || "ALL";
  const zone = params.zone || "ALL";
  const status = params.status || "ALL";
  const importId = params.importId || "ALL";
  const importMessage =
    params.importError === "db_limit"
      ? "A importação parou porque a base de dados atingiu o limite de espaço do Neon. É necessário libertar espaço/apagar importações antigas ou aumentar o plano antes de continuar."
      : params.folderError === "missing"
        ? "Ainda não existe uma pasta cloud configurada para sincronização automática."
        : params.folderError
          ? `Não foi possível sincronizar a pasta: ${params.folderError}`
          : params.folderSync
            ? `Sincronização concluída: ${params.checked ?? 0} ficheiro(s) encontrados, ${params.processed ?? 0} processado(s), ${params.imported ?? 0} novo(s), ${params.duplicates ?? 0} duplicado(s), ${params.invalid ?? 0} inválido(s), ${params.skipped ?? 0} já tratados, ${params.remaining ?? 0} por processar.`
      : params.imported || params.duplicates || params.empty || params.invalid
        ? `Importação concluída: ${params.imported ?? 0} novo(s), ${params.duplicates ?? 0} duplicado(s), ${params.empty ?? 0} vazio(s), ${params.invalid ?? 0} inválido(s).`
        : null;
  const data = await getEnvironmentalData({ days, type, zone, status, importId });
  const imports = data.imports as Array<{ id: string; fileName: string; importedAt: Date; rowsCount: number; source?: string; fileHash?: string | null; sourceUrl?: string | null }>;
  const lastImport = imports[0] ?? null;
  const zones = data.zones as string[];
  const pressureRows = data.pressureRows as EnvironmentalRow[];
  const temperatureRows = data.temperatureRows as EnvironmentalRow[];
  const humidityRows = data.humidityRows as EnvironmentalRow[];
  const eventRows = data.eventRows as EnvironmentalEventRow[];
  const actionEvents = data.actionEvents as EnvironmentalActionEvent[];
  const sensorRows = data.bySensor as EnvironmentalRow[];
  const hourlyRows = data.hourly as Array<{ hour: string; average: number }>;
  const settings = data.settings as EnvironmentalSettings;
  const configuredFolder =
    settings.sharePointFolderUrl ||
    settings.googleDriveFolderUrl ||
    settings.googleDriveFolderId ||
    "";
  const configuredFolderLabel = configuredFolder
    ? configuredFolder.includes("sharepoint.com") || configuredFolder.includes("onedrive")
      ? "SharePoint / OneDrive"
      : "Google Drive"
    : "Sem pasta cloud definida";
  const pdfQuery = new URLSearchParams({
    days,
    type,
    zone,
    status,
    importId,
  }).toString();
  const environmentalReturnPath = `/ambiental?${pdfQuery}`;

  return (
    <AppShell activeHref="/ambiental">
      <PageHeader
        eyebrow="Monitorização ambiental"
        title="Tratamento ambiental"
        description="Lê relatórios diários Excel a partir de ficheiros ou de uma pasta e organiza temperatura, humidade, pressão diferencial, alertas, ações e eventos por zona."
      />

      {importMessage ? (
        <section className={`rounded-lg border p-4 ${params.importError === "db_limit" || params.folderError ? "border-rose-300/40 bg-rose-300/10 text-rose-100" : "border-teal-300/40 bg-teal-300/10 text-teal-100"}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className={params.importError === "db_limit" || params.folderError ? "mt-0.5 text-rose-200" : "mt-0.5 text-teal-200"} />
            <p className="text-sm leading-6">{importMessage}</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-5">
        <Panel>
          <p className="text-sm text-zinc-500">Estado geral</p>
          <p className={data.state === "ACAO" ? "mt-2 text-2xl font-semibold text-rose-200" : data.state === "ATENÇÃO" ? "mt-2 text-2xl font-semibold text-amber-200" : "mt-2 text-2xl font-semibold text-emerald-200"}>
            {data.state}
          </p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Total ações</p>
          <p className="mt-2 text-3xl font-semibold text-rose-200">{data.totalActions}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Total alertas</p>
          <p className="mt-2 text-3xl font-semibold text-amber-200">{data.totalAlerts}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Leituras tratadas</p>
          <p className="mt-2 text-3xl font-semibold text-teal-200">{data.readingsCount}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Ultima importação</p>
          <p className="mt-2 text-base font-semibold text-zinc-50">{lastImport ? formatDate(lastImport.importedAt) : "Sem dados"}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">{lastImport?.fileName ?? "Sem ficheiro"}</p>
        </Panel>
      </section>

      <section className="space-y-4">
        <aside className="grid gap-4 xl:grid-cols-4">
          <Panel className="xl:col-span-4">
            <div className="flex items-center gap-3">
              <Search size={20} className="text-teal-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Filtros</h2>
            </div>
            <form className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              <select name="days" className={`${inputClass} min-w-0 text-sm`} defaultValue={days}>
                <option value="1">24h</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
              </select>
              <select name="type" className={`${inputClass} min-w-0 text-sm`} defaultValue={type}>
                <option value="ALL">Tipos</option>
                <option value="TEMPERATURE">Temperatura</option>
                <option value="HUMIDITY">Humidade</option>
                <option value="PRESSURE">Pressão</option>
              </select>
              <select name="zone" className={`${inputClass} min-w-0 text-sm`} defaultValue={zone}>
                <option value="ALL">Zonas</option>
                {zones.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select name="status" className={`${inputClass} min-w-0 text-sm`} defaultValue={status}>
                <option value="ALL">Estados</option>
                <option value="OK">OK</option>
                <option value="ALERT">Alerta</option>
                <option value="ACTION">Ação</option>
              </select>
              <select name="importId" className={`${inputClass} min-w-0 text-sm`} defaultValue={importId}>
                <option value="ALL">Importações</option>
                {imports.map((item) => (
                  <option key={item.id} value={item.id}>{item.fileName}</option>
                ))}
              </select>
              <button className={`${buttonClass} w-full whitespace-nowrap text-sm`}>Filtrar</button>
              <a
                href={`/api/ambiental/pdf?${pdfQuery}`}
                className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-teal-300/40 bg-teal-300/10 px-4 text-center text-sm font-semibold leading-tight text-teal-100 transition hover:border-teal-200"
              >
                <Download size={16} className="shrink-0" />
                <span className="min-w-0">Exportar PDF</span>
              </a>
            </form>
          </Panel>

          <Panel className="xl:col-span-4">
            <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-teal-300/30 bg-teal-300/10 text-teal-200">
                  <Cloud size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Fonte dos relatórios</p>
                  <h2 className="mt-1 text-xl font-semibold text-zinc-50">{configuredFolderLabel}</h2>
                  <p className="mt-1 max-w-full truncate text-sm text-zinc-500">
                    {configuredFolder || "Seleciona uma pasta para a app ler os documentos sem guardar os ficheiros originais."}
                  </p>
                </div>
              </div>
              <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-80">
                <DetailsModal
                  id="fonte-relatorios-ambiental"
                  title="fonte dos relatórios"
                  maxWidth="max-w-4xl"
                  button={
                    <span className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-teal-300/40 bg-teal-300/10 px-4 text-sm font-semibold text-teal-100 transition hover:border-teal-200">
                      <FolderSync size={17} />
                      Definir pasta
                    </span>
                  }
                >
                  <Panel>
                    <div className="flex items-center gap-3">
                      <FolderSync size={22} className="text-teal-300" />
                      <h2 className="text-xl font-semibold text-zinc-50">Fonte dos relatórios ambientais</h2>
                    </div>

                    <form action={updateEnvironmentalSettings} className="mt-4 space-y-3">
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Pasta SharePoint, OneDrive ou Google Drive</span>
                        <input
                          name="environmentalFolderUrl"
                          className={inputClass}
                          defaultValue={configuredFolder}
                          placeholder="Link da pasta onde estão os relatórios"
                        />
                      </label>
                      <button className={buttonClass}>Guardar pasta</button>
                    </form>

                    <div className="mt-5">
                      <EnvironmentalFolderImporter />
                    </div>

                    <p className="mt-4 text-xs leading-5 text-zinc-500">
                      A sincronização cloud usa a pasta configurada. A leitura local pede para escolher a pasta no browser e não guarda os ficheiros originais na app.
                    </p>
                  </Panel>
                </DetailsModal>

                <form action={syncEnvironmentalFolder}>
                  <button className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-center text-sm font-semibold leading-tight text-zinc-100 transition hover:border-teal-300/50">
                    <FolderSync size={17} className="shrink-0" />
                    <span className="min-w-0">Sincronizar agora</span>
                  </button>
                </form>
              </div>
            </div>
          </Panel>

          <div className="grid gap-3 md:grid-cols-3 xl:col-span-4">
          <DetailsModal
            id="horario-alertas-ambiental"
            title="horario de alertas"
            maxWidth="max-w-3xl"
            button={
              <span className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
                <AlertTriangle size={17} />
                Editar horario de alertas
              </span>
            }
          >
          <Panel>
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-amber-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Horario de alertas</h2>
            </div>
            <form action={updateEnvironmentalSettings} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Inicio</span>
                  <input name="alertStartTime" type="time" className={inputClass} defaultValue={settings.alertStartTime} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Fim</span>
                  <input name="alertEndTime" type="time" className={inputClass} defaultValue={settings.alertEndTime} />
                </label>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/65 px-3 py-3 text-sm text-zinc-200">
                Incluir sabado nos alertas
                <input name="includeSaturday" type="checkbox" defaultChecked={settings.includeSaturday} className="size-4 accent-teal-300" />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/65 px-3 py-3 text-sm text-zinc-200">
                Incluir domingo nos alertas
                <input name="includeSunday" type="checkbox" defaultChecked={settings.includeSunday} className="size-4 accent-teal-300" />
              </label>
              <button className={buttonClass}>Guardar horario</button>
            </form>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Fora deste horario as leituras continuam no histórico, mas nao contam para alertas, ações ou eventos.
            </p>
          </Panel>
          </DetailsModal>
          <DetailsModal
            id="importar-relatorio-ambiental"
            title="importar relatório"
            maxWidth="max-w-3xl"
            button={
              <span className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
                <FileSpreadsheet size={17} />
                Importar relatório
              </span>
            }
          >
          <Panel>
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={22} className="text-lime-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Importar relatório</h2>
            </div>
            <form action={importEnvironmentalReport} encType="multipart/form-data" className="mt-4 space-y-3">
              <input name="files" required multiple type="file" accept=".xlsx,.xls,.xlsm,.csv" className={inputClass} />
              <button className={buttonClass}>Importar Excel(s)</button>
            </form>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Podes selecionar varios ficheiros. Aceita T1/H1/PA e tambem Temperature1/Humidity1/PressureA, com mapeamento automatico para salas e ligacoes.
            </p>
          </Panel>
          </DetailsModal>
          <DetailsModal
            id="importacoes-ambientais"
            title="importações"
            maxWidth="max-w-3xl"
            button={
              <span className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
                <FileSpreadsheet size={17} />
                Ver importações
              </span>
            }
          >
          <Panel>
            <h2 className="text-xl font-semibold text-zinc-50">Ultimas importações</h2>
            <div className="mt-4 space-y-2">
              {imports.length === 0 ? (
                <EmptyState title="Sem importações" description="Importa o primeiro relatório para iniciar o histórico." />
              ) : (
                imports.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-3">
                    <p className="truncate text-sm font-semibold text-zinc-100">{item.fileName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatDate(item.importedAt)} - {item.rowsCount} leituras</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {item.source ?? "MANUAL"} {item.fileHash ? `- ${item.fileHash.slice(0, 10)}` : ""}
                    </p>
                    {item.sourceUrl ? (
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-teal-200">
                        Abrir origem
                      </a>
                    ) : null}
                    <form action={deleteEnvironmentalImport} className="mt-3">
                      <input type="hidden" name="id" value={item.id} />
                      <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-200">
                        <Trash2 size={14} />
                        Eliminar importação
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </Panel>
          </DetailsModal>
          </div>
        </aside>

        <section className="space-y-4">
          <Panel>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                title="Ações ambientais"
                description="Registo detalhado dos eventos que ultrapassaram o limite de tempo e devem suportar auditorias e levantamento de nao conformidades."
              />
              <ModuleCodificationField moduleKey="ambiental" returnPath={environmentalReturnPath} />
            </div>
            {actionEvents.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Sem ações ambientais" description="não existem eventos fora de limite com duração suficiente no período filtrado." />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-230 text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Data / hora inicio</th>
                      <th className="px-3 py-2">Data / hora fim</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Zona</th>
                      <th className="px-3 py-2">Limite</th>
                      <th className="px-3 py-2">Valores fora</th>
                      <th className="px-3 py-2">Duração</th>
                      <th className="px-3 py-2">Leituras</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {actionEvents.map((event) => (
                      <tr key={`${event.type}-${event.zone}-${event.startedAt.toISOString()}`} className="text-zinc-200">
                        <td className="px-3 py-3 font-semibold text-zinc-50">{formatDateTime(event.startedAt)}</td>
                        <td className="px-3 py-3">{formatDateTime(event.endedAt)}</td>
                        <td className="px-3 py-3">{event.label}</td>
                        <td className="px-3 py-3 font-semibold text-zinc-50">{event.zone}</td>
                        <td className="px-3 py-3 text-amber-200">{event.limit}</td>
                        <td className="px-3 py-3 text-rose-200">
                          {formatNumber(event.min)} a {formatNumber(event.max)} {unit(event.type)}
                        </td>
                        <td className="px-3 py-3 font-semibold text-rose-200">{formatDuration(event.durationSeconds)}</td>
                        <td className="px-3 py-3">{event.readingsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle title="Pressão diferencial" description="Resumo por ligação, com ocorrências abaixo de 5 Pa e eventos contínuos superiores a 40 minutos." />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-210 text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Ligação</th>
                    <th className="px-3 py-2">Média</th>
                    <th className="px-3 py-2">Mínimo</th>
                    <th className="px-3 py-2">Máximo</th>
                    <th className="px-3 py-2">Ocorrências &lt;5Pa</th>
                    <th className="px-3 py-2">Eventos &gt;40min</th>
                    <th className="px-3 py-2">Leituras alerta</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {pressureRows.map((row) => (
                    <tr key={row.zone} className="text-zinc-200">
                      <td className="px-3 py-3 font-semibold text-zinc-50">{row.zone}</td>
                      <td className="px-3 py-3">{formatNumber(row.average)} Pa</td>
                      <td className="px-3 py-3">{formatNumber(row.min)} Pa</td>
                      <td className="px-3 py-3">{formatNumber(row.max)} Pa</td>
                      <td className="px-3 py-3 text-amber-200">{row.lowPressureOccurrences ?? row.occurrences}</td>
                      <td className="px-3 py-3 text-rose-200">{row.events40min ?? row.events}</td>
                      <td className="px-3 py-3">{row.alertReadingsCount ?? 0}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                          {row.count === 0 ? "Sem dados" : statusLabel(row.status)}
                        </span>
                        {row.ignoreLowPressure ? (
                          <p className="mt-1 text-[11px] text-zinc-500">Media &lt;1,5 Pa considerada OK</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <ReadingTable
            title="Temperatura por sala"
            description="Media, minimo, maximo, alertas e acoes por sala."
            rows={temperatureRows}
            type="TEMPERATURE"
          />

          <ReadingTable
            title="Humidade por sala"
            description="Media, minimo, maximo, alertas e ações por sala."
            rows={humidityRows}
            type="HUMIDITY"
          />

          <Panel>
            <SectionTitle title="Eventos >40min" description="Eventos por zona, incluindo pressão acima de 40 minutos e temperatura/humidade acima de 24 horas." />
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {eventRows.map((row) => {
                const active = row.pressureEvents40min + row.temperatureEvents24h + row.humidityEvents24h > 0;
                return (
                  <div key={row.zone} className={`rounded-lg border p-3 ${active ? "border-rose-300/30 bg-rose-300/10" : "border-zinc-800 bg-zinc-950/65"}`}>
                    <p className="font-semibold text-zinc-50">{row.zone}</p>
                    <div className="mt-3 space-y-1 text-xs text-zinc-400">
                      <p>Pressão &gt;40min: <span className="font-semibold text-zinc-100">{row.pressureEvents40min}</span></p>
                      <p>Temperatura 24h: <span className="font-semibold text-zinc-100">{row.temperatureEvents24h}</span></p>
                      <p>Humidade 24h: <span className="font-semibold text-zinc-100">{row.humidityEvents24h}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <AlertTriangle size={22} className="text-amber-300" />
              <SectionTitle title="Sensores / leituras recentes" description="Lista detalhada ja normalizada por zona, tipo e estado." />
            </div>
            <div className="mt-4 max-h-140 space-y-2 overflow-y-auto pr-1">
              {sensorRows.length === 0 ? (
                <EmptyState title="Sem sensores tratados" description="Importa o relatório para ver sensores e estados." />
              ) : (
                sensorRows.map((sensor) => (
                  <div key={`${sensor.type}-${sensor.zone}`} className={`rounded-lg border p-3 ${statusClass(sensor.status)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{sensor.zone}</p>
                        <p className="mt-1 text-xs opacity-75">{sensor.label}</p>
                      </div>
                      <span className="rounded-md border border-current/30 px-2 py-1 text-xs font-semibold">{statusLabel(sensor.status)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <span>Min. {formatNumber(sensor.min)} {unit(sensor.type)}</span>
                      <span>Med. {formatNumber(sensor.average)} {unit(sensor.type)}</span>
                      <span>Max. {formatNumber(sensor.max)} {unit(sensor.type)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <Leaf size={22} className="text-lime-300" />
              <SectionTitle title="Histórico horário" description="édia horária das leituras filtradas para perceber tendência recente." />
            </div>
            <div className="mt-4 space-y-2">
              {hourlyRows.length === 0 ? (
                <EmptyState title="Sem dados para gráfico" description="As medias horárias aparecem depois da importação." />
              ) : (
                hourlyRows.map((item) => {
                  const maxBar = Math.max(...hourlyRows.map((hour) => Math.abs(hour.average)), 1);
                  return (
                    <div key={item.hour} className="grid grid-cols-[90px_minmax(0,1fr)_70px] items-center gap-3 text-xs">
                      <span className="text-zinc-500">{item.hour}</span>
                      <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
                        <div className="h-full rounded-full bg-teal-300" style={{ width: `${Math.max((Math.abs(item.average) / maxBar) * 100, 4)}%` }} />
                      </div>
                      <span className="text-right font-semibold text-zinc-200">{formatNumber(item.average)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        </section>
      </section>
    </AppShell>
  );
}
