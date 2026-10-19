import Link from "next/link";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { entryTypes, getChemicalReport, lisbonDate } from "@/lib/chemical-report";
import { productTypeLabel } from "@/lib/product-types";

export const dynamic = "force-dynamic";

export default async function ChemicalReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  let report;
  try {
    report = await getChemicalReport(params.from, params.to);
  } catch (error) {
    // Preserve authentication redirects and framework control-flow errors.
    if (error && typeof error === "object" && "digest" in error) throw error;
    return <AppShell activeHref="/inventario"><Panel><p role="alert">Não foi possível gerar o relatório. Verifica o período e tenta novamente.</p><Link href="/inventario/quimicos" className={buttonClass}>Repor período</Link></Panel></AppShell>;
  }
  const query = new URLSearchParams({ from: report.start, to: report.end });
  return (
    <AppShell activeHref="/inventario">
      <PageHeader eyebrow="Ambiente · Stock" title="Entradas de produtos químicos" description="Entradas diretas, stock inicial e ajustes positivos, apresentados separadamente. Datas de Portugal continental." action={<Link href="/inventario" className={buttonClass}>Voltar ao inventário</Link>} />
      <Panel>
        <form className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2">Desde<input type="date" name="from" required defaultValue={report.start} className={inputClass} /></label>
          <label className="grid gap-2">Até<input type="date" name="to" required defaultValue={report.end} className={inputClass} /></label>
          <button className={buttonClass}>Consultar</button>
          <a href={`/api/inventario/quimicos?${query}`} className={buttonClass}>Exportar CSV (Excel)</a>
        </form>
        <p className="mt-4 text-sm text-zinc-400">{report.entries.length} movimento(s). Classificação e unidades conforme a ficha atual do produto. Este relatório não equivale a um registo de compras: inclui stock inicial e ajustes. Entradas antigas sem movimento registado não podem ser reconstruídas.</p>
        {report.unclassified > 0 && <p className="mt-3 text-amber-200">Existem {report.unclassified} produtos por classificar, excluídos deste relatório. <Link href="/inventario?productType=UNCLASSIFIED" className="underline">Rever produtos</Link>.</p>}
      </Panel>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr>{["Data", "Produto", "Tipo de produto", "Fornecedor", "Movimento", "Quantidade", "Motivo"].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
            <tbody>{report.entries.map((entry) => <tr key={entry.id} className="border-t border-zinc-800">
              <td className="p-3 whitespace-nowrap">{lisbonDate(entry.date)}</td>
              <td className="p-3"><Link href={`/inventario/consumiveis/${entry.consumableId}`} className="text-teal-300">{entry.consumable.name}</Link></td>
              <td className="p-3">{productTypeLabel(entry.consumable.productType)}</td>
              <td className="p-3">{entry.consumable.supplier ?? "—"}</td>
              <td className="p-3">{entryTypes[entry.type as keyof typeof entryTypes]}</td>
              <td className="p-3 whitespace-nowrap">{String(entry.quantity)} {entry.consumable.unit}</td>
              <td className="p-3">{entry.reason ?? "—"}</td>
            </tr>)}</tbody>
          </table>
          {report.entries.length === 0 && <p className="p-3 text-zinc-400">Sem entradas registadas de produtos classificados como químicos neste período.</p>}
        </div>
      </Panel>
    </AppShell>
  );
}
