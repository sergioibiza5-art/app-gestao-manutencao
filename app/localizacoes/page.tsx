import type { ReactNode } from "react";
import { AlertTriangle, Archive, Camera, Edit3, Map, PackageSearch, Plus, Search, Trash2 } from "lucide-react";

import { createStoragePosition, deleteStoragePosition, updateStoragePosition } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { DetailsPopup } from "@/app/components/details-modal";
import { DetailsOpenButton } from "@/app/components/details-open-button";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { requireUser } from "@/lib/auth";
import { getStorageLocationsData } from "@/lib/data";

export const dynamic = "force-dynamic";

type StorageLocationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    room?: string;
    shelf?: string;
    status?: string;
    erro?: string;
  }>;
};

type StoragePosition = Awaited<ReturnType<typeof getStorageLocationsData>>["positions"][number];

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function statusTone(status: string) {
  const tones: Record<string, { label: string; card: string; badge: string }> = {
    ORGANIZED: {
      label: "Organizado",
      card: "border-teal-300/30 bg-teal-950/15",
      badge: "border-teal-300/35 bg-teal-300/10 text-teal-100",
    },
    REVIEW: {
      label: "A rever",
      card: "border-amber-300/45 bg-amber-950/15",
      badge: "border-amber-300/40 bg-amber-300/10 text-amber-100",
    },
    EMPTY: {
      label: "Vazio",
      card: "border-zinc-700 bg-zinc-950/55",
      badge: "border-zinc-700 bg-zinc-900 text-zinc-300",
    },
  };

  return tones[status] ?? tones.ORGANIZED;
}

function contentLines(contents: string) {
  return contents
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function PositionForm({ position }: { position?: StoragePosition }) {
  return (
    <form action={position ? updateStoragePosition : createStoragePosition} className="grid gap-3 md:grid-cols-4">
      {position ? <input type="hidden" name="id" value={position.id} /> : null}

      <Field label="Código">
        <input name="code" className={inputClass} defaultValue={position?.code ?? ""} placeholder="Ex.: AE.3" />
      </Field>
      <Field label="Sala / zona">
        <input name="room" className={inputClass} defaultValue={position?.room ?? ""} placeholder="Ex.: Oficina" />
      </Field>
      <Field label="Estante">
        <input name="shelf" required className={inputClass} defaultValue={position?.shelf ?? ""} placeholder="Ex.: AE" />
      </Field>
      <Field label="Nível">
        <input name="level" required className={inputClass} defaultValue={position?.level ?? ""} placeholder="Ex.: 3" />
      </Field>

      <Field label="Nome curto" className="md:col-span-2">
        <input name="title" className={inputClass} defaultValue={position?.title ?? ""} placeholder="Ex.: Peças Nilfisk / acessórios" />
      </Field>
      <Field label="Estado">
        <select name="status" className={inputClass} defaultValue={position?.status ?? "ORGANIZED"}>
          <option value="ORGANIZED">Organizado</option>
          <option value="REVIEW">A rever</option>
          <option value="EMPTY">Vazio</option>
        </select>
      </Field>
      <Field label="Foto / link">
        <input name="photoUrl" className={inputClass} defaultValue={position?.photoUrl ?? ""} placeholder="Link da foto" />
      </Field>

      <Field label="Conteúdo da posição" className="md:col-span-4">
        <textarea
          name="contents"
          required
          className={`${textareaClass} min-h-36`}
          defaultValue={position?.contents ?? ""}
          placeholder={"Uma linha por item. Ex.:\nFiltros ASP-4\nLâminas\nAcessórios ar comprimido"}
        />
      </Field>
      <Field label="Observações" className="md:col-span-4">
        <textarea
          name="notes"
          className={textareaClass}
          defaultValue={position?.notes ?? ""}
          placeholder="Notas úteis para encontrar, identificar ou reorganizar a posição."
        />
      </Field>

      <button className={`${buttonClass} md:col-span-2`}>{position ? "Guardar alterações" : "Guardar posição"}</button>
    </form>
  );
}

export default async function StorageLocationsPage({ searchParams }: StorageLocationsPageProps) {
  const params = (await searchParams) ?? {};
  const user = await requireUser();
  const canDelete = user.role === "ADMIN" || user.role === "MANAGER";
  const data = await getStorageLocationsData(params);

  return (
    <AppShell activeHref="/localizacoes">
      <PageHeader
        eyebrow="Localização"
        title="Mapa de estantes"
        description="Regista onde estão caixas, acessórios, peças soltas e materiais que não precisam de gestão de stock."
        action={
          <DetailsOpenButton targetId="nova-posicao" className={buttonClass}>
            <Plus size={18} />
            Nova posição
          </DetailsOpenButton>
        }
      />

      <DetailsPopup id="nova-posicao" title="Nova posição" maxWidth="max-w-5xl">
        <Panel>
          <div className="mb-4 flex items-center gap-3">
            <Map size={22} className="text-fuchsia-200" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Cadastro</p>
              <h2 className="text-xl font-semibold text-zinc-50">Nova posição</h2>
            </div>
          </div>
          <PositionForm />
        </Panel>
      </DetailsPopup>

      {params.erro ? (
        <div className="rounded-lg border border-rose-300/40 bg-rose-950/25 p-4 text-sm font-semibold text-rose-100">
          {params.erro}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Panel>
          <p className="text-sm text-zinc-500">Posições</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-50">{data.totalCount}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Resultado do filtro</p>
          <p className="mt-2 text-3xl font-semibold text-teal-200">{data.filteredCount}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">A rever</p>
          <p className="mt-2 text-3xl font-semibold text-amber-200">{data.reviewCount}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Vazias</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-200">{data.emptyCount}</p>
        </Panel>
      </section>

      <Panel>
        <div className="mb-4 flex items-center gap-3">
          <Search size={20} className="text-teal-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Filtros</h2>
        </div>
        <form className="grid gap-3 lg:grid-cols-[minmax(220px,1.6fr)_repeat(3,minmax(150px,1fr))_auto_auto]">
          <input name="q" defaultValue={params.q ?? ""} className={inputClass} placeholder="Pesquisar por código, conteúdo, sala..." />
          <select name="room" defaultValue={params.room ?? ""} className={inputClass}>
            <option value="">Todas as salas</option>
            {data.rooms.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
          <select name="shelf" defaultValue={params.shelf ?? ""} className={inputClass}>
            <option value="">Todas as estantes</option>
            {data.shelves.map((shelf) => (
              <option key={shelf} value={shelf}>
                {shelf}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={params.status ?? ""} className={inputClass}>
            <option value="">Todos os estados</option>
            <option value="ORGANIZED">Organizado</option>
            <option value="REVIEW">A rever</option>
            <option value="EMPTY">Vazio</option>
          </select>
          <button className={buttonClass}>Filtrar</button>
          <a
            href="/localizacoes"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50"
          >
            Limpar
          </a>
        </form>
      </Panel>

      <section className="grid gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-50">Mapa por estante</h2>
            <p className="mt-1 text-sm text-zinc-500">Clica em editar para atualizar rapidamente o conteúdo de uma prateleira.</p>
          </div>
        </div>

        {data.positions.length === 0 ? (
          <Panel>
            <EmptyState
              title="Sem posições registadas"
              description="Cria a primeira posição para começares a mapear as estantes AA, AB, AC, AE, AF e outras zonas."
            />
          </Panel>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {Object.entries(data.groupedByShelf).map(([shelf, positions]) => (
              <Panel key={shelf}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Archive size={21} className="text-fuchsia-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Estante</p>
                      <h3 className="text-2xl font-semibold text-zinc-50">{shelf}</h3>
                    </div>
                  </div>
                  <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-300">
                    {positions.length} posição(ões)
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {positions.map((position) => {
                    const tone = statusTone(position.status);
                    const lines = contentLines(position.contents);
                    const modalId = `editar-posicao-${position.id}`;

                    return (
                      <article key={position.id} className={`rounded-lg border p-4 ${tone.card}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">{position.code}</p>
                            <h4 className="mt-1 text-lg font-semibold text-zinc-50">{position.title || `Prateleira ${position.level}`}</h4>
                            <p className="mt-1 text-xs text-zinc-500">{position.room ?? "Sem sala definida"}</p>
                          </div>
                          <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone.badge}`}>{tone.label}</span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {lines.slice(0, 6).map((line) => (
                            <span key={line} className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-xs font-semibold text-zinc-200">
                              {line}
                            </span>
                          ))}
                          {lines.length > 6 ? (
                            <span className="rounded-md border border-teal-300/25 bg-teal-300/10 px-2 py-1 text-xs font-semibold text-teal-100">
                              + {lines.length - 6}
                            </span>
                          ) : null}
                        </div>

                        {position.notes ? <p className="mt-3 line-clamp-2 text-sm text-zinc-500">{position.notes}</p> : null}

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <DetailsOpenButton
                            targetId={modalId}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 text-xs font-semibold text-zinc-100 transition hover:border-teal-300/50"
                          >
                            <Edit3 size={14} />
                            Editar
                          </DetailsOpenButton>
                          {position.photoUrl ? (
                            <a
                              href={position.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sky-300/30 bg-sky-300/10 px-3 text-xs font-semibold text-sky-100"
                            >
                              <Camera size={14} />
                              Foto
                            </a>
                          ) : null}
                        </div>

                        <DetailsPopup id={modalId} title={`Editar ${position.code}`} maxWidth="max-w-5xl">
                          <Panel>
                            <div className="mb-4 flex items-center gap-3">
                              <PackageSearch size={22} className="text-fuchsia-200" />
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Editar posição</p>
                                <h2 className="text-xl font-semibold text-zinc-50">{position.code}</h2>
                              </div>
                            </div>
                            <PositionForm position={position} />
                            {canDelete ? (
                              <form action={deleteStoragePosition} className="mt-3">
                                <input type="hidden" name="id" value={position.id} />
                                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-400/35 bg-rose-400/10 px-3 text-sm font-semibold text-rose-200 transition hover:border-rose-300">
                                  <Trash2 size={15} />
                                  Eliminar posição
                                </button>
                              </form>
                            ) : null}
                          </Panel>
                        </DetailsPopup>
                      </article>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>

      <Panel className="border-fuchsia-300/20">
        <div className="flex items-start gap-3">
          <AlertTriangle size={21} className="mt-0.5 text-amber-200" />
          <div>
            <h2 className="font-semibold text-zinc-50">Sugestão de codificação</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Usa o mesmo formato das etiquetas físicas: estante + nível, por exemplo AA.4, AC.2 ou AF.6. O campo código é gerado
              automaticamente se preencheres estante e nível.
            </p>
          </div>
        </div>
      </Panel>
    </AppShell>
  );
}
