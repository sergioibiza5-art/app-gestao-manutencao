import Link from "next/link";
import { FileText, Plus, Search, X } from "lucide-react";

import { createExpense } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { DetailsModal } from "@/app/components/details-modal";
import {
  buttonClass,
  EmptyState,
  inputClass,
  PageHeader,
  Panel,
  textareaClass,
} from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type ExpensesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    supplier?: string;
    costCenter?: string;
    equipmentId?: string;
    vehicleId?: string;
    page?: string;
  }>;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = (await searchParams) ?? {};
  const { expenses, equipment, vehicles } = await getModuleData();

  const q = normalize(params.q);
  const status = String(params.status ?? "");
  const supplier = String(params.supplier ?? "");
  const costCenter = String(params.costCenter ?? "");
  const equipmentId = String(params.equipmentId ?? "");
  const vehicleId = String(params.vehicleId ?? "");
  const page = Math.max(Number(params.page ?? 1), 1);
  const pageSize = 12;

  const suppliers = Array.from(
    new Set(expenses.map((expense) => expense.supplier).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, "pt"));

  const costCenters = Array.from(
    new Set(expenses.map((expense) => expense.costCenter || expense.category).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, "pt"));

  const filteredExpenses = expenses.filter((expense) => {
    const haystack = [
      expense.title,
      expense.supplier,
      expense.costCenter,
      expense.category,
      expense.status,
      expense.equipment?.name,
      expense.equipment?.code,
      expense.vehicle?.brand,
      expense.vehicle?.model,
      expense.vehicle?.plate,
      expense.notes,
    ]
      .map(normalize)
      .join(" ");

    const expenseCostCenter = expense.costCenter || expense.category || "";

    return (
      (!q || haystack.includes(q)) &&
      (!status || expense.status === status) &&
      (!supplier || expense.supplier === supplier) &&
      (!costCenter || expenseCostCenter === costCenter) &&
      (!equipmentId || expense.equipment?.id === equipmentId) &&
      (!vehicleId || expense.vehicle?.id === vehicleId)
    );
  });

  const totalFiltered = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );
  const pageCount = Math.max(Math.ceil(filteredExpenses.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount);
  const pagedExpenses = filteredExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const queryWithoutPage = new URLSearchParams(
    Object.entries(params).filter(([key, value]) => key !== "page" && typeof value === "string" && value.length > 0) as string[][],
  );
  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams(queryWithoutPage);
    query.set("page", String(targetPage));
    return `/despesas?${query.toString()}`;
  };

  const newExpenseAction = (
    <DetailsModal
      id="nova-despesa"
      title="nova despesa"
      maxWidth="max-w-3xl"
      button={
        <span className={buttonClass}>
          <Plus size={18} />
          Nova despesa
        </span>
      }
    >
      <Panel>
        <h2 className="text-xl font-semibold text-zinc-50">Nova despesa</h2>

        <form action={createExpense} className="mt-4 space-y-3">
          <input name="title" required className={inputClass} placeholder="TÃ­tulo" />
          <input name="supplier" className={inputClass} placeholder="Fornecedor" />

          <div className="grid grid-cols-2 gap-3">
            <input name="amount" required className={inputClass} placeholder="Valor" />
            <input name="costCenter" className={inputClass} placeholder="Centro de custo" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input name="date" type="date" className={inputClass} />
            <select name="status" className={inputClass}>
              <option value="PAID">Pago</option>
              <option value="PENDING">Pendente</option>
              <option value="CANCELED">Cancelado</option>
            </select>
          </div>

          <input name="category" className={inputClass} placeholder="Categoria" />

          <select name="equipmentId" className={inputClass}>
            <option value="">Sem equipamento associado</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.code ? ` Â· ${item.code}` : ""}
              </option>
            ))}
          </select>

          <select name="vehicleId" className={inputClass}>
            <option value="">Sem viatura associada</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.brand} {vehicle.model} - {vehicle.plate}
              </option>
            ))}
          </select>

          <div className="grid gap-3 md:grid-cols-2">
            <input name="invoiceUrl" className={inputClass} placeholder="Link/caminho da fatura" />
            <input name="invoiceName" className={inputClass} placeholder="Nome do ficheiro" />
          </div>

          <textarea name="notes" className={textareaClass} placeholder="Notas ou referÃªncia documental" />
          <button className={buttonClass}>Guardar despesa</button>
        </form>
      </Panel>
    </DetailsModal>
  );

  return (
    <AppShell activeHref="/despesas">
      <PageHeader
        eyebrow="Financeiro"
        title="Despesas e faturas"
        description="Regista despesas, associa equipamentos e guarda a cópia da fatura para rastreabilidade."
              action={newExpenseAction}
      />

      <section>
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Registos de despesas</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {filteredExpenses.length} resultado(s) · {formatCurrency(totalFiltered)}
              </p>
            </div>

            <Link
              href="/despesas"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50"
            >
              <X size={16} />
              Limpar
            </Link>
          </div>

          <form className="mt-4 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/45 p-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(145px,1fr))_auto]">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                name="q"
                defaultValue={params.q ?? ""}
                className={`${inputClass} pl-9`}
                placeholder="Pesquisar por título, fornecedor, equipamento, viatura, matrícula..."
              />
            </div>

            <select name="status" defaultValue={status} className={inputClass}>
              <option value="">Todos os estados</option>
              <option value="PAID">Pago</option>
              <option value="PENDING">Pendente</option>
              <option value="CANCELED">Cancelado</option>
            </select>

            <select name="supplier" defaultValue={supplier} className={inputClass}>
              <option value="">Todos os fornecedores</option>
              {suppliers.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select name="costCenter" defaultValue={costCenter} className={inputClass}>
              <option value="">Todos os centros</option>
              {costCenters.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select name="equipmentId" defaultValue={equipmentId} className={inputClass}>
              <option value="">Todos os equipamentos</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.code ? ` · ${item.code}` : ""}
                </option>
              ))}
            </select>

            <select name="vehicleId" defaultValue={vehicleId} className={inputClass}>
              <option value="">Todas as viaturas</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model} - {vehicle.plate}
                </option>
              ))}
            </select>

            <button className={buttonClass}>Aplicar filtros</button>
          </form>

          <div className="mt-4 space-y-3">
            {filteredExpenses.length === 0 ? (
              <EmptyState
                title="Sem despesas encontradas"
                description="Não existem registos com os filtros selecionados."
              />
            ) : (
              pagedExpenses.map((expense) => {
                const invoice = expense.documents.find(
                  (document) => document.type === "INVOICE" && document.fileUrl
                );

                return (
                  <Link
                    key={expense.id}
                    href={`/despesas/${expense.id}`}
                    className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 transition hover:border-amber-300/50 hover:bg-zinc-900/70"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100">{expense.title}</h3>

                        <p className="mt-1 text-sm text-zinc-500">
                          {expense.supplier ?? "Sem fornecedor"}
                          {(expense.costCenter || expense.category) && (
                            <> · {expense.costCenter || expense.category}</>
                          )}
                        </p>

                        <p className="mt-1 text-xs text-zinc-600">
                          {expense.equipment
                            ? `Equipamento: ${expense.equipment.name}`
                            : expense.vehicle
                              ? `Viatura: ${expense.vehicle.brand} ${expense.vehicle.model} - ${expense.vehicle.plate}`
                              : "Sem equipamento ou viatura associada"}
                        </p>

                        {invoice && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-300">
                            <FileText size={13} />
                            Fatura associada
                          </span>
                        )}
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="font-semibold text-amber-300">{formatCurrency(expense.amount)}</p>
                        <p className="mt-1 text-xs text-zinc-500">{formatDate(expense.date)}</p>
                        <p className="mt-1 text-xs text-zinc-600">{expense.status}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
          {filteredExpenses.length > pageSize && (
            <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">
                Pagina {currentPage} de {pageCount}
              </p>
              <div className="flex gap-2">
                <Link
                  href={pageHref(Math.max(currentPage - 1, 1))}
                  className={`inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold ${currentPage === 1 ? "pointer-events-none text-zinc-700" : "text-zinc-100 hover:border-teal-300/50"}`}
                >
                  Anterior
                </Link>
                <Link
                  href={pageHref(Math.min(currentPage + 1, pageCount))}
                  className={`inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold ${currentPage === pageCount ? "pointer-events-none text-zinc-700" : "text-zinc-100 hover:border-teal-300/50"}`}
                >
                  Seguinte
                </Link>
              </div>
            </div>
          )}
        </Panel>
      </section>
    </AppShell>
  );
}
