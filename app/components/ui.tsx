import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="glass-panel rounded-lg p-4 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-teal-300">{eyebrow}</p>
          <h2 className="text-3xl font-semibold leading-tight text-zinc-50 sm:text-4xl">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        {action}
      </div>
    </section>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass-panel rounded-lg p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-5 text-center">
      <p className="font-medium text-zinc-200">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-teal-300/60";

export const textareaClass =
  "min-h-24 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-teal-300/60";

export const buttonClass =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-teal-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200";
