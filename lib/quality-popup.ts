export type QualityPopupCall = {
  id: string;
  batchId: string;
  lot: string;
  reference: string;
  line: string;
  equipment: string;
  calledAt: string;
  stopped: boolean;
};

export const qualityPopupStorageKey = (userId: string) => `quality-popup:${userId}`;

export function qualityPopupAcknowledged(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200))].slice(-500) : [];
  } catch {
    return [];
  }
}
