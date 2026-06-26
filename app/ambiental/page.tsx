import { AlertTriangle, FileSpreadsheet, Leaf, Search, Trash2 } from "lucide-react";

import { deleteEnvironmentalImport, importEnvironmentalReport, updateEnvironmentalSettings } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { getEnvironmentalData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type EnvironmentalPageProps = {
  searchParams?: Promise<{ days?: string; type?: string; zone?: string; status?: string; importId?: string }>;
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
  if (status === "ACTION") return "Acao";
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
        <table className="w-full min-w-[720px] text-left text-sm">
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

  return (
    <AppShell activeHref="/ambiental">
      <PageHeader
        eyebrow="Monitorizacao ambiental"
        title="Tratamento ambiental"
        description="Importa relatorios diarios Excel e organiza temperatura, humidade, pressao diferencial, alertas, acoes e eventos por zona."
      />

      <section className="grid gap-4 md:grid-cols-5">
        <Panel>
          <p className="text-sm text-zinc-500">Estado geral</p>
          <p className={data.state === "ACAO" ? "mt-2 text-2xl font-semibold text-rose-200" : data.state === "ATENCAO" ? "mt-2 text-2xl font-semibold text-amber-200" : "mt-2 text-2xl font-semibold text-emerald-200"}>
            {data.state}
          </p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Total acoes</p>
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
          <p className="text-sm text-zinc-500">Ultima importacao</p>
          <p className="mt-2 text-base font-semibold text-zinc-50">{lastImport ? formatDate(lastImport.importedAt) : "Sem dados"}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">{lastImport?.fileName ?? "Sem ficheiro"}</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel>
            <div className="flex items-center gap-3">
              <Search size={20} className="text-teal-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Filtros</h2>
            </div>
            <form className="mt-4 space-y-3">
              <select name="days" className={inputClass} defaultValue={days}>
                <option value="1">Ultimas 24h</option>
                <option value="7">Ultimos 7 dias</option>
                <option value="30">Ultimos 30 dias</option>
                <option value="90">Ultimos 90 dias</option>
              </select>
              <select name="type" className={inputClass} defaultValue={type}>
                <option value="ALL">Todos os tipos</option>
                <option value="TEMPERATURE">Temperatura</option>
                <option value="HUMIDITY">Humidade</option>
                <option value="PRESSURE">Pressao</option>
              </select>
              <select name="zone" className={inputClass} defaultValue={zone}>
                <option value="ALL">Todas as zonas</option>
                {zones.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select name="status" className={inputClass} defaultValue={status}>
                <option value="ALL">Todos os estados</option>
                <option value="OK">OK</option>
                <option value="ALERT">Alerta</option>
                <option value="ACTION">Acao</option>
              </select>
              <select name="importId" className={inputClass} defaultValue={importId}>
                <option value="ALL">Todas as importacoes</option>
                {imports.map((item) => (
                  <option key={item.id} value={item.id}>{item.fileName}</option>
                ))}
              </select>
              <button className={buttonClass}>Filtrar</button>
            </form>
          </Panel>

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
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Pasta Google Drive</span>
                <input
                  name="googleDriveFolderUrl"
                  className={inputClass}
                  defaultValue={settings.googleDriveFolderUrl ?? settings.googleDriveFolderId ?? ""}
                  placeholder="Link ou ID da pasta dos relatórios ambientais"
                />
              </label>
              <button className={buttonClass}>Guardar horario</button>
            </form>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Fora deste horario as leituras continuam no historico, mas nao contam para alertas, acoes ou eventos.
            </p>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={22} className="text-lime-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Importar relatorio</h2>
            </div>
            <form action={importEnvironmentalReport} encType="multipart/form-data" className="mt-4 space-y-3">
              <input name="file" required type="file" accept=".xlsx,.xls,.xlsm,.csv" className={inputClass} />
              <button className={buttonClass}>Importar Excel</button>
            </form>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Aceita T1/H1/PA e tambem Temperature1/Humidity1/PressureA, com mapeamento automatico para salas e ligacoes.
            </p>
          </Panel>

          <Panel>
            <h2 className="text-xl font-semibold text-zinc-50">Ultimas importacoes</h2>
            <div className="mt-4 space-y-2">
              {imports.length === 0 ? (
                <EmptyState title="Sem importacoes" description="Importa o primeiro relatorio para iniciar o historico." />
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
                        Eliminar importacao
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </aside>

        <section className="space-y-4">
          <Panel>
            <SectionTitle
              title="Acoes ambientais"
              description="Registo detalhado dos eventos que ultrapassaram o limite de tempo e devem suportar auditorias e levantamento de nao conformidades."
            />
            {actionEvents.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Sem acoes ambientais" description="Nao existem eventos fora de limite com duracao suficiente no periodo filtrado." />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Data / hora inicio</th>
                      <th className="px-3 py-2">Data / hora fim</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Zona</th>
                      <th className="px-3 py-2">Limite</th>
                      <th className="px-3 py-2">Valores fora</th>
                      <th className="px-3 py-2">Duracao</th>
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
            <SectionTitle title="Pressao diferencial" description="Resumo por ligacao, com ocorrencias abaixo de 5 Pa e eventos continuos superiores a 40 minutos." />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Ligacao</th>
                    <th className="px-3 py-2">Media</th>
                    <th className="px-3 py-2">Minimo</th>
                    <th className="px-3 py-2">Maximo</th>
                    <th className="px-3 py-2">Ocorrencias &lt;5Pa</th>
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
            description="Media, minimo, maximo, alertas e acoes por sala."
            rows={humidityRows}
            type="HUMIDITY"
          />

          <Panel>
            <SectionTitle title="Eventos >40min" description="Eventos por zona, incluindo pressao acima de 40 minutos e temperatura/humidade acima de 24 horas." />
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {eventRows.map((row) => {
                const active = row.pressureEvents40min + row.temperatureEvents24h + row.humidityEvents24h > 0;
                return (
                  <div key={row.zone} className={`rounded-lg border p-3 ${active ? "border-rose-300/30 bg-rose-300/10" : "border-zinc-800 bg-zinc-950/65"}`}>
                    <p className="font-semibold text-zinc-50">{row.zone}</p>
                    <div className="mt-3 space-y-1 text-xs text-zinc-400">
                      <p>Pressao &gt;40min: <span className="font-semibold text-zinc-100">{row.pressureEvents40min}</span></p>
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
                <EmptyState title="Sem sensores tratados" description="Importa o relatorio para ver sensores e estados." />
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
              <SectionTitle title="Historico horario" description="Media horaria das leituras filtradas para perceber tendencia recente." />
            </div>
            <div className="mt-4 space-y-2">
              {hourlyRows.length === 0 ? (
                <EmptyState title="Sem dados para grafico" description="As medias horarias aparecem depois da importacao." />
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
