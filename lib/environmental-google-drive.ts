import { createSign } from "node:crypto";

import { importEnvironmentalWorkbook, type ImportEnvironmentalWorkbookResult } from "@/lib/environmental-import";

const driveScope = "https://www.googleapis.com/auth/drive.readonly";
const supportedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/octet-stream",
  "text/csv",
  "application/vnd.google-apps.spreadsheet",
]);
const supportedFileExtensions = [".xlsx", ".xls", ".xlsm", ".csv"];

type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  shortcutDetails?: {
    targetId?: string;
    targetMimeType?: string;
  };
};

function isSupportedDriveFile(file: GoogleDriveFile) {
  const lowerName = file.name.toLowerCase();
  return supportedMimeTypes.has(file.mimeType) || supportedFileExtensions.some((extension) => lowerName.endsWith(extension));
}

function base64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function googlePrivateKey() {
  if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }

  return process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";
}

function folderIdFromInput(input: string) {
  const trimmed = input.trim();
  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch?.[1]) return foldersMatch[1];

  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam?.[1]) return idParam[1];

  return trimmed;
}

async function googleAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = googlePrivateKey();

  if (!email || !privateKey) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: email,
    scope: driveScope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token Google Drive: ${response.status}`);
  }

  const payloadJson = await response.json() as { access_token?: string };
  if (!payloadJson.access_token) {
    throw new Error("Resposta Google sem access_token.");
  }

  return payloadJson.access_token;
}

function googleHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function apiKeyQuery() {
  return process.env.GOOGLE_DRIVE_API_KEY ? `&key=${encodeURIComponent(process.env.GOOGLE_DRIVE_API_KEY)}` : "";
}

async function googleFetch(url: string, token: string | null) {
  const response = await fetch(`${url}${url.includes("?") ? "" : "?"}${token ? "" : apiKeyQuery().replace(/^&/, "")}`, {
    headers: googleHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pedido Google Drive falhou: ${response.status}`);
  }

  return response;
}

export async function listGoogleDriveEnvironmentalFiles(folderInput: string) {
  const folderId = folderIdFromInput(folderInput);
  const token = await googleAccessToken();
  const files: GoogleDriveFile[] = [];
  let pageToken = "";

  do {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,shortcutDetails(targetId,targetMimeType))");
    const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const key = token ? "" : apiKeyQuery();
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${page}${key}`;
    const response = await fetch(url, {
      headers: googleHeaders(token),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Listagem Google Drive falhou: ${response.status}`);
    }

    const payload = await response.json() as { files?: GoogleDriveFile[]; nextPageToken?: string };
    files.push(...(payload.files ?? []).filter((file) => file.mimeType === "application/vnd.google-apps.shortcut" || isSupportedDriveFile(file)));
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function downloadGoogleDriveFile(file: GoogleDriveFile, token: string | null) {
  const key = token ? "" : apiKeyQuery();
  const fileId = file.shortcutDetails?.targetId ?? file.id;
  const mimeType = file.shortcutDetails?.targetMimeType ?? file.mimeType;
  const url = mimeType === "application/vnd.google-apps.spreadsheet"
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}${key}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true${key}`;
  const response = await googleFetch(url, token);
  return Buffer.from(await response.arrayBuffer());
}

export async function importGoogleDriveEnvironmentalReports(folderInput: string) {
  const token = await googleAccessToken();
  const files = await listGoogleDriveEnvironmentalFiles(folderInput);
  const results: ImportEnvironmentalWorkbookResult[] = [];

  for (const file of files) {
    try {
      const buffer = await downloadGoogleDriveFile(file, token);
      results.push(await importEnvironmentalWorkbook({
        buffer,
        fileName: file.name,
        source: "GOOGLE_DRIVE",
        sourceUrl: file.webViewLink,
        sourceModifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido ao importar ficheiro.";
      console.error(`Falha ao importar ficheiro ambiental do Google Drive (${file.name}):`, error);
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
    imported: results.filter((result) => result.status === "imported").length,
    duplicates: results.filter((result) => result.status === "duplicate").length,
    invalid: results.filter((result) => result.status === "invalid" || result.status === "empty").length,
    results,
  };
}
