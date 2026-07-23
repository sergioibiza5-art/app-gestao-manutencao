import { Save } from "lucide-react";

import { updateModuleCodification } from "@/app/actions";
import { inputClass } from "@/app/components/ui";
import { getModuleCodification } from "@/lib/data";

export async function ModuleCodificationField({
  moduleKey,
  returnPath,
  className = "",
}: {
  moduleKey: string;
  returnPath: string;
  className?: string;
}) {
  const code = await getModuleCodification(moduleKey);

  return (
    <form
      action={updateModuleCodification}
      className={`flex w-full min-w-0 flex-col gap-1 sm:w-auto ${className}`}
    >
      <input type="hidden" name="moduleKey" value={moduleKey} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Codificacao
      </label>
      <div className="grid grid-cols-[minmax(150px,220px)_44px] gap-2">
        <div className="min-w-0">
          <input
            name="code"
            defaultValue={code}
            className={`${inputClass} min-w-0 uppercase`}
            placeholder="CODIGO"
            aria-label="Codificacao do modulo"
          />
        </div>
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg border border-teal-300/40 bg-teal-300/10 text-teal-100 transition hover:border-teal-200 hover:bg-teal-300/15"
          aria-label="Guardar codificacao"
          title="Guardar codificacao"
        >
          <Save size={17} />
        </button>
      </div>
    </form>
  );
}
