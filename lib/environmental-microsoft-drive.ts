import { importEnvironmentalWorkbook, type ImportEnvironmentalWorkbookResult } from "@/lib/environmental-import";
import { getPrisma } from "@/lib/prisma";

const supportedFileExtensions = [".xlsx", ".xls", ".xlsm", ".csv"];

type MicrosoftDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  file?: unknown;
  folder?: unknown;
  parentReference?: {
    driveId?: string;
  };
  "@microsoft.graph.downloadUrl"?: string;
};

type MicrosoftChildrenResponse = {
  value?: MicrosoftDriveItem[];
  "@odata.nextLink"?: string;
};

type ImportMicrosoftEnvironmentalReportsOptions = {
  limit?: number;
};

function isSupportedFile(item: MicrosoftDriveItem) {
  if (!item.file) return false;
  const lowerName = item.name.toLowerCase();
  return supportedFileExtensions.some((extension) => lowerName.endsWith(extension));
}

function fileSourceKey(file: MicrosoftDriveItem) {
  return file.webUrl ?? `sharepoint:${file.parentReference?.driveId ?? "drive"}:${file.id}`;
}

function sameModifiedTime(left?: Date | string | null, right?: string | null) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return new Date(left).getTime() === new Date(right).getTime();
}

function base64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function shareToken(folderUrl: string) {
  return `u!${base64Url(folderUrl)}`;
}

async function microsoftAccessToken() {
  const tenantId = process.env.MICROSOFT_TENANT_ID || process.env.AZURE_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Ligação Microsoft não configurada. Falta MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET.");
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter acesso Microsoft: ${response.status}`);
  }

  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Resposta Microsoft sem acesso.");
  }

  return payload.access_token;
}

async function graphFetch(url: string, token: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pedido Microsoft Graph falhou: ${response.status}`);
  }

  return response;
}

async function listChildren(url: string, token: string) {
  const items: MicrosoftDriveItem[] = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await graphFetch(nextUrl, token);
    const payload = await response.json() as MicrosoftChildrenResponse;
    items.push(...(payload.value ?? []));
    nextUrl = payload["@odata.nextLink"] ?? "";
  }

  return items;
}

async function listChildrenRecursive(url: string, token: string, depth = 0): Promise<MicrosoftDriveItem[]> {
  const items = await listChildren(url, token);
  const files = items.filter(isSupportedFile);
  const folders = depth >= 3 ? [] : items.filter((item) => item.folder && item.parentReference?.driveId);
  const nested = await Promise.all(
    folders.map((folder) => {
      const driveId = encodeURIComponent(folder.parentReference?.driveId ?? "");
      const itemId = encodeURIComponent(folder.id);
      const childUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/children?$select=id,name,webUrl,lastModifiedDateTime,file,folder,parentReference,@microsoft.graph.downloadUrl&$top=200`;
      return listChildrenRecursive(childUrl, token, depth + 1);
    }),
  );

  return [...files, ...nested.flat()];
}

export async function listMicrosoftEnvironmentalFiles(folderUrl: string) {
  const token = await microsoftAccessToken();
  const rootUrl = `https://graph.microsoft.com/v1.0/shares/${shareToken(folderUrl)}/driveItem/children?$select=id,name,webUrl,lastModifiedDateTime,file,folder,parentReference,@microsoft.graph.downloadUrl&$top=200`;
  const files = await listChildrenRecursive(rootUrl, token);

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function downloadMicrosoftFile(file: MicrosoftDriveItem, token: string) {
  const downloadUrl = file["@microsoft.graph.downloadUrl"];
  if (!downloadUrl) {
    throw new Error(`Ficheiro sem ligação de download: ${file.name}`);
  }

  const response = await fetch(downloadUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Download Microsoft falhou: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function importMicrosoftEnvironmentalReports(folderUrl: string, options: ImportMicrosoftEnvironmentalReportsOptions = {}) {
  const token = await microsoftAccessToken();
  const files = await listMicrosoftEnvironmentalFiles(folderUrl);
  const prisma = getPrisma();
  const limit = Math.max(1, Math.min(options.limit ?? 25, 75));
  const results: ImportEnvironmentalWorkbookResult[] = [];
  const sourceKeys = files.map(fileSourceKey);
  const existingImports = await prisma.environmentalImport.findMany({
    where: {
      source: "SHAREPOINT",
      sourceUrl: { in: sourceKeys },
    },
    select: {
      sourceUrl: true,
      sourceModifiedAt: true,
    },
  });
  const importedBySource = new Map(existingImports.map((item) => [item.sourceUrl, item]));
  const pendingFiles = files.filter((file) => {
    const existing = importedBySource.get(fileSourceKey(file));
    return !existing || !sameModifiedTime(existing.sourceModifiedAt, file.lastModifiedDateTime);
  });
  const batchFiles = pendingFiles.slice(0, limit);

  for (const file of batchFiles) {
    try {
      const buffer = await downloadMicrosoftFile(file, token);
      results.push(await importEnvironmentalWorkbook({
        buffer,
        fileName: file.name,
        source: "SHAREPOINT",
        sourceUrl: fileSourceKey(file),
        sourceModifiedAt: file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime) : null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido ao importar ficheiro.";
      console.error(`Falha ao importar ficheiro ambiental do SharePoint (${file.name}):`, error);
      results.push({
        status: "invalid",
        fileName: file.name,
        readingsCount: 0,
        fileHash: "",
        error: message,
      });
    }
  }

  return {
    checked: files.length,
    skippedAlreadyImported: files.length - pendingFiles.length,
    processed: batchFiles.length,
    batchLimit: limit,
    remaining: Math.max(pendingFiles.length - batchFiles.length, 0),
    imported: results.filter((result) => result.status === "imported").length,
    duplicates: results.filter((result) => result.status === "duplicate").length,
    invalid: results.filter((result) => result.status === "invalid" || result.status === "empty").length,
    results,
  };
}
