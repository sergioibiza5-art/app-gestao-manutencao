import { importEnvironmentalWorkbook, type ImportEnvironmentalWorkbookResult } from "@/lib/environmental-import";

const supportedExtensions = [".xlsx", ".xls", ".xlsm", ".csv"];

type GraphDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  file?: unknown;
  folder?: unknown;
  "@microsoft.graph.downloadUrl"?: string;
};

type SharePointFile = {
  id: string;
  name: string;
  webUrl?: string;
  downloadUrl: string;
  lastModifiedDateTime?: string;
};

function base64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function shareIdFromUrl(url: string) {
  return `u!${base64Url(url)}`;
}

function hasSupportedExtension(name: string) {
  return supportedExtensions.some((extension) => name.toLowerCase().endsWith(extension));
}

async function graphAccessToken() {
  if (process.env.MICROSOFT_GRAPH_ACCESS_TOKEN) {
    return process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Configura as variáveis MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET para importar do SharePoint.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token Microsoft Graph: ${response.status}`);
  }

  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Resposta do Microsoft Graph sem access_token.");
  }

  return payload.access_token;
}

async function graphGet<T>(url: string, token: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pedido Microsoft Graph falhou: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listSharePointEnvironmentalFiles(folderUrl: string) {
  const token = await graphAccessToken();
  const files: SharePointFile[] = [];
  let url = `https://graph.microsoft.com/v1.0/shares/${shareIdFromUrl(folderUrl)}/driveItem/children?$top=200`;

  while (url) {
    const payload = await graphGet<{ value?: GraphDriveItem[]; "@odata.nextLink"?: string }>(url, token);
    for (const item of payload.value ?? []) {
      if (!item.file || !hasSupportedExtension(item.name) || !item["@microsoft.graph.downloadUrl"]) continue;
      files.push({
        id: item.id,
        name: item.name,
        webUrl: item.webUrl,
        downloadUrl: item["@microsoft.graph.downloadUrl"],
        lastModifiedDateTime: item.lastModifiedDateTime,
      });
    }

    url = payload["@odata.nextLink"] ?? "";
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function importSharePointEnvironmentalReports(folderUrl: string) {
  const files = await listSharePointEnvironmentalFiles(folderUrl);
  const results: ImportEnvironmentalWorkbookResult[] = [];

  for (const file of files) {
    const response = await fetch(file.downloadUrl, { cache: "no-store" });
    if (!response.ok) {
      results.push({
        status: "invalid",
        fileName: file.name,
        readingsCount: 0,
        fileHash: "",
      });
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    results.push(await importEnvironmentalWorkbook({
      buffer,
      fileName: file.name,
      source: "SHAREPOINT",
      sourceUrl: file.webUrl,
      sourceModifiedAt: file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime) : null,
    }));
  }

  return {
    checked: files.length,
    imported: results.filter((result) => result.status === "imported").length,
    duplicates: results.filter((result) => result.status === "duplicate").length,
    invalid: results.filter((result) => result.status === "invalid" || result.status === "empty").length,
    results,
  };
}
