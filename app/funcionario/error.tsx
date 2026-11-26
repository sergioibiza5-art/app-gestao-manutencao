"use client";

export default function EmployeeDayError({ reset }: { reset: () => void }) {
  return <section className="m-4 space-y-4 p-5 text-zinc-100"><h2 className="text-xl font-semibold">Não foi possível carregar o dia de trabalho</h2><p>Os registos não foram alterados.</p><button onClick={reset} className="min-h-11 rounded-lg bg-teal-300 px-4 text-zinc-950">Tentar novamente</button></section>;
}
