import Link from "next/link";
import { ReactNode } from "react";
import { HomeIcon, Search, ShieldCheck } from "lucide-react";

import { navigation } from "@/lib/navigation";

type AppShellProps = {
  activeHref?: string;
  children: ReactNode;
};

export function AppShell({ activeHref = "/", children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.10),transparent_25%),#070807]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-panel sticky top-3 z-30 flex items-center justify-between gap-3 rounded-lg px-3 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal-400 text-zinc-950">
              <HomeIcon size={22} strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold text-zinc-50 sm:text-2xl">Gestão de manutenção</span>
            </span>
          </Link>
          <button className="grid size-11 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-950/70 text-zinc-200 transition hover:border-teal-300/50 hover:text-teal-200" aria-label="Pesquisa e filtros">
            <Search size={20} />
          </button>
        </header>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="glass-panel quiet-scrollbar min-w-0 overflow-hidden rounded-lg p-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">Módulos</p>
                <h1 className="text-base font-semibold text-zinc-100">Navegação</h1>
              </div>
              <ShieldCheck size={20} className="text-teal-300" />
            </div>

            <nav className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex min-w-52 items-center gap-3 rounded-lg border p-3 text-left transition lg:min-w-0 ${
                      active
                        ? "border-teal-300/35 bg-teal-300/10"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/80"
                    }`}
                  >
                    <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${item.color}`}>
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-100">{item.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">{item.meta}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">{children}</div>
        </div>
      </div>
    </main>
  );
}
