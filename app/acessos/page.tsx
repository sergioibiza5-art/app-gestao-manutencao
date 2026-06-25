import { createSgqRecord, createUser, deleteUser, updateUser } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";

export const dynamic = "force-dynamic";

const roleDescriptions = [
  ["ADMIN", "Acesso total: utilizadores, permissoes, configuracao, apagar registos e gerir SGQ."],
  ["MANAGER", "Planeia e gere: equipamentos, manutencoes, frota, checklists, documentos e aprovacao operacional."],
  ["SGQ", "SGQ/metrologia: cria e edita equipamentos e calibracoes. Apenas consulta Analises e KPIs. Sem acesso aos restantes modulos."],
  ["USER", "Executa trabalho diario: tarefas, leituras, checklists, despesas, documentos e registos de intervencao."],
  ["VIEWER", "Consulta apenas: dashboard, historicos, calendario, documentos e fichas, sem criar ou editar."],
  ["TICKET", "Posto de trabalho: apenas cria tickets de avaria para a maquina/posto, sem acesso aos restantes modulos."],
];

const notifyDays = [
  ["1", "Seg"],
  ["2", "Ter"],
  ["3", "Qua"],
  ["4", "Qui"],
  ["5", "Sex"],
  ["6", "Sáb"],
  ["0", "Dom"],
];

type AccessPageProps = {
  searchParams?: Promise<{ erro?: string }>;
};

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const params = (await searchParams) ?? {};
  const { users, sgqRecords, equipment } = await getModuleData();

  return (
    <AppShell activeHref="/acessos">
      <PageHeader
        eyebrow="Segurança e SGQ"
        title="Utilizadores, acessos e registos SGQ"
        description="Define níveis de acesso e mantém registos controlados com código, versão, estado e aprovação."
      />

      {params.erro ? (
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm font-medium text-rose-100">
          {params.erro}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Novo utilizador</h2>
          <form action={createUser} className="mt-4 space-y-3">
            <input name="name" required className={inputClass} placeholder="Nome" />
            <input name="username" className={inputClass} placeholder="Utilizador do posto (sem email)" />
            <input name="email" type="email" className={inputClass} placeholder="Email (perfis normais)" />
            <input name="password" type="password" className={inputClass} placeholder="Palavra-passe inicial" />
            <input name="hourlyRate" className={inputClass} placeholder="Custo hora mao de obra" />
            <select name="role" className={inputClass}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Gestor</option>
              <option value="SGQ">SGQ</option>
              <option value="USER">Utilizador</option>
              <option value="VIEWER">Leitura</option>
              <option value="TICKET">Posto / Ticket</option>
            </select>
            <select name="active" className={inputClass}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
              <p className="text-sm font-semibold text-zinc-100">Horário de alertas</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input name="notifyStartTime" type="time" defaultValue="08:00" className={inputClass} aria-label="Início dos alertas" />
                <input name="notifyEndTime" type="time" defaultValue="18:00" className={inputClass} aria-label="Fim dos alertas" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {notifyDays.map(([value, label]) => (
                  <label key={value} className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-black/20 px-3 py-2 text-xs font-semibold text-zinc-300">
                    <input type="checkbox" name="notifyDay" value={value} defaultChecked={["1", "2", "3", "4", "5"].includes(value)} className="size-4 accent-teal-300" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px]">
                <input name="telegramChatId" className={inputClass} placeholder="ID do chat Telegram" />
                <select name="telegramEnabled" className={inputClass} defaultValue="true">
                  <option value="true">Telegram ativo</option>
                  <option value="false">Telegram desligado</option>
                </select>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
              <p className="text-sm font-semibold text-zinc-100">Equipamentos autorizados para ticket</p>
              <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1">
                {equipment.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 rounded-md border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                    <input type="checkbox" name="ticketEquipmentId" value={item.id} className="size-4 accent-teal-300" />
                    <span>{item.name}{item.code ? ` - ${item.code}` : ""}</span>
                  </label>
                ))}
              </div>
            </div>
            <button className={buttonClass}>Guardar utilizador</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Registo SGQ</h2>
          <form action={createSgqRecord} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input name="code" className={inputClass} placeholder="Código" />
              <input name="version" defaultValue="1.0" className={inputClass} placeholder="Versão" />
            </div>
            <input name="title" required className={inputClass} placeholder="Título" />
            <select name="status" className={inputClass}>
              <option value="DRAFT">Rascunho</option>
              <option value="ACTIVE">Ativo</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
            <textarea name="description" className={textareaClass} placeholder="Descrição" />
            <button className={buttonClass}>Guardar registo SGQ</button>
          </form>
        </Panel>
      </section>

      <Panel>
        <h2 className="text-xl font-semibold text-zinc-50">Niveis de acesso</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {roleDescriptions.map(([role, description]) => (
            <article key={role} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
              <h3 className="font-semibold text-violet-200">{role}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
            </article>
          ))}
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Utilizadores</h2>
          <div className="mt-4 space-y-3">
            {users.length === 0 ? (
              <EmptyState title="Sem utilizadores" description="Cria utilizadores para separar permissões por perfil." />
            ) : (
              users.map((user) => (
                <article key={user.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <form action={updateUser} className="grid gap-2 md:grid-cols-2">
                    <input type="hidden" name="id" value={user.id} />
                    <input name="name" className={inputClass} defaultValue={user.name} />
                    <input name="username" className={inputClass} defaultValue={user.username ?? ""} placeholder="Utilizador do posto" />
                    <input name="email" type="email" className={inputClass} defaultValue={user.email.endsWith("@ticket.local") ? "" : user.email} placeholder="Email" />
                    <input name="password" type="password" className={inputClass} placeholder="Nova palavra-passe" />
                    <input name="hourlyRate" className={inputClass} defaultValue={String(user.hourlyRate ?? 0)} placeholder="Custo hora" />
                    <select name="role" className={inputClass} defaultValue={user.role}>
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Gestor</option>
                      <option value="SGQ">SGQ</option>
                      <option value="USER">Utilizador</option>
                      <option value="VIEWER">Leitura</option>
                      <option value="TICKET">Posto / Ticket</option>
                    </select>
                    <select name="active" className={inputClass} defaultValue={user.active ? "true" : "false"}>
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                    <div className="rounded-lg border border-zinc-800 bg-black/20 p-3 md:col-span-2">
                      <p className="text-sm font-semibold text-zinc-100">Horário de alertas</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input name="notifyStartTime" type="time" className={inputClass} defaultValue={user.notifyStartTime ?? "08:00"} aria-label="Início dos alertas" />
                        <input name="notifyEndTime" type="time" className={inputClass} defaultValue={user.notifyEndTime ?? "18:00"} aria-label="Fim dos alertas" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {notifyDays.map(([value, label]) => {
                          const checked = (user.notifyDays ?? "1,2,3,4,5").split(",").includes(value);
                          return (
                            <label key={value} className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/45 px-3 py-2 text-xs font-semibold text-zinc-300">
                              <input type="checkbox" name="notifyDay" value={value} defaultChecked={checked} className="size-4 accent-teal-300" />
                              {label}
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_170px]">
                        <input name="telegramChatId" className={inputClass} defaultValue={user.telegramChatId ?? ""} placeholder="ID do chat Telegram" />
                        <select name="telegramEnabled" className={inputClass} defaultValue={user.telegramEnabled ? "true" : "false"}>
                          <option value="true">Telegram ativo</option>
                          <option value="false">Telegram desligado</option>
                        </select>
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-black/20 p-3 md:col-span-2">
                      <p className="text-sm font-semibold text-zinc-100">Equipamentos permitidos para este posto</p>
                      <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                        {equipment.map((item) => {
                          const checked = user.ticketEquipmentAccess.some((access) => access.equipmentId === item.id);
                          return (
                            <label key={item.id} className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/45 px-3 py-2 text-sm text-zinc-300">
                              <input type="checkbox" name="ticketEquipmentId" value={item.id} defaultChecked={checked} className="size-4 accent-teal-300" />
                              <span>{item.name}{item.code ? ` - ${item.code}` : ""}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <button className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">Atualizar</button>
                  </form>
                  <form action={deleteUser} className="mt-2">
                    <input type="hidden" name="id" value={user.id} />
                    <button className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-200">
                      Eliminar utilizador
                    </button>
                  </form>
                </article>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Registos SGQ</h2>
          <div className="mt-4 space-y-3">
            {sgqRecords.length === 0 ? (
              <EmptyState title="Sem registos SGQ" description="Cria procedimentos, evidências ou registos controlados para rastreabilidade." />
            ) : (
              sgqRecords.map((record) => (
                <article key={record.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{record.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{record.code ?? "sem código"} · v{record.version}</p>
                    </div>
                    <p className="text-sm font-medium text-emerald-300">{record.status}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
