"use client";

import { FolderOpen, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { importEnvironmentalParsedReports } from "@/app/actions";
import { buttonClass, inputClass } from "@/app/components/ui";
import { parseEnvironmentalWorkbookReadings } from "@/lib/environmental-workbook";

const supportedExtensions = [".xlsx", ".xls", ".xlsm", ".csv"];

type ImportSummary = {
  imported: number;
  duplicates: number;
  empty: number;
  invalid: number;
  readings: number;
};

function isSupportedFile(file: File) {
  const name = file.name.toLowerCase();
  return supportedExtensions.some((extension) => name.endsWith(extension));
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function EnvironmentalFolderImporter() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [status, setStatus] = useState("Nenhuma pasta lida nesta sessão.");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function importFiles(files: File[]) {
    const supportedFiles = files.filter(isSupportedFile);
    const totals: ImportSummary = { imported: 0, duplicates: 0, empty: 0, invalid: files.length - supportedFiles.length, readings: 0 };

    setIsReading(true);
    setSummary(null);

    try {
      if (supportedFiles.length === 0) {
        setStatus("Não encontrei relatórios Excel/CSV nessa pasta.");
        setSummary(totals);
        return;
      }

      for (let index = 0; index < supportedFiles.length; index += 1) {
        const file = supportedFiles[index];
        setStatus(`A ler ${index + 1}/${supportedFiles.length}: ${file.name}`);

        try {
          const buffer = await file.arrayBuffer();
          const parsedReadings = parseEnvironmentalWorkbookReadings(buffer);
          const result = await importEnvironmentalParsedReports([
            {
              fileName: file.name,
              relativePath: file.webkitRelativePath || file.name,
              fileHash: await sha256Hex(buffer),
              sourceModifiedAt: new Date(file.lastModified).toISOString(),
              readings: parsedReadings.map((reading) => ({
                ...reading,
                timestamp: reading.timestamp.toISOString(),
              })),
            },
          ]);

          totals.imported += result.imported;
          totals.duplicates += result.duplicates;
          totals.empty += result.empty;
          totals.invalid += result.invalid;
          totals.readings += result.readings;
        } catch (error) {
          totals.invalid += 1;
          console.error(`Falha ao ler relatorio ambiental da pasta (${file.name}):`, error);
        }
      }

      setStatus("Leitura da pasta concluída.");
      setSummary(totals);
      router.refresh();
    } finally {
      setIsReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-teal-300/25 bg-teal-300/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-50">Ler pasta no computador</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">A app lê os ficheiros na pasta escolhida e guarda apenas as leituras tratadas.</p>
        </div>
        <button
          type="button"
          className={`${buttonClass} w-full sm:w-auto`}
          disabled={isReading}
          onClick={() => inputRef.current?.click()}
        >
          {isReading ? <Loader2 size={17} className="animate-spin" /> : <FolderOpen size={17} />}
          Selecionar pasta
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          void importFiles(files);
        }}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
      />

      <div className={`${inputClass} flex h-auto min-h-11 items-center text-zinc-400`}>
        {status}
      </div>

      {summary ? (
        <div className="grid gap-2 text-sm sm:grid-cols-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Novos</p>
            <p className="mt-1 text-lg font-semibold text-teal-200">{summary.imported}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Duplicados</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">{summary.duplicates}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Sem dados</p>
            <p className="mt-1 text-lg font-semibold text-amber-200">{summary.empty}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Falhas</p>
            <p className="mt-1 text-lg font-semibold text-rose-200">{summary.invalid}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Leituras</p>
            <p className="mt-1 text-lg font-semibold text-cyan-200">{summary.readings}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
