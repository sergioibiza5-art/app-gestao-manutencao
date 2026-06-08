import { createSgqRecord, createUser } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const { users, sgqRecords } = await getModuleData();

  return (
    <AppShell activeHref="/acessos">
      <PageHeader
        eyebrow="Segurança e SGQ"
        title="Utilizadores, acessos e registos SGQ"
        description="Define níveis de acesso e mantém registos controlados com código, versão, estado e aprovação."
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Novo utilizador</h2>
          <form action={createUser} className="mt-4 space-y-3">
            <input name="name" required className={inputClass} placeholder="Nome" />
            <input name="email" required type="email" className={inputClass} placeholder="Email" />
            <select name="role" className={inputClass}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Gestor</option>
              <option value="USER">Utilizador</option>
              <option value="VIEWER">Leitura</option>
            </select>
            <select name="active" className={inputClass}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
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

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Utilizadores</h2>
          <div className="mt-4 space-y-3">
            {users.length === 0 ? (
              <EmptyState title="Sem utilizadores" description="Cria utilizadores para separar permissões por perfil." />
            ) : (
              users.map((user) => (
                <article key={user.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{user.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
                    </div>
                    <p className="text-sm font-medium text-violet-300">{user.role}</p>
                  </div>
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
