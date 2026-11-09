import { calibrationGroups } from "@/lib/calibration-alerts";
import { absoluteUrl, escapeHtml } from "@/lib/email-alerts";

type CalibrationEntry = { group: number; date: string; id: string; title: string; equipment: string };

const tones = ["#9d302d", "#91520f", "#17645c", "#355778"];

export function renderCalibrationEmail(entries: CalibrationEntry[], today: string) {
  const dateLabel = new Intl.DateTimeFormat("pt-PT", { dateStyle: "full", timeZone: "Europe/Lisbon" })
    .format(new Date(today + "T12:00:00Z"));
  const sections = calibrationGroups.map((label, group) => {
    const items = entries.filter(entry => entry.group === group);
    if (!items.length) return "";
    const rows = items.map(entry => {
      const id = encodeURIComponent(entry.id);
      const href = escapeHtml(absoluteUrl(`/calibracao?calibrationId=${id}#calibration-${id}`));
      return `<tr>
        <td style="padding:13px 8px 13px 0;border-bottom:1px solid #dbe4df;overflow-wrap:anywhere">
          <a href="${href}" style="color:#154c45;font-size:16px;font-weight:bold;text-decoration:underline">${escapeHtml(entry.title)}</a>
          <div style="margin-top:4px;font-size:13px;color:#4c605b">${escapeHtml(entry.equipment)}</div>
        </td>
        <td style="width:92px;text-align:right;border-bottom:1px solid #dbe4df;font-size:14px;white-space:nowrap">${escapeHtml(entry.date.split("-").reverse().join("/"))}</td>
      </tr>`;
    }).join("");
    return `<h2 style="margin:22px 0 0;padding:7px 10px;background:#f2f5f3;border-left:4px solid ${tones[group]};color:${tones[group]};font-size:15px">${label} (${items.length})</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
  }).join("");
  return `<div style="background:#edf2ef;padding:16px 8px;font-family:Arial,Helvetica,sans-serif;color:#203b35">
    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #d2ded7;border-radius:12px">
      <tr><td bgcolor="#153e37" style="padding:24px;color:#ffffff;border-radius:11px 11px 0 0">
        <p style="margin:0 0 12px;color:#c6e6d8;font-size:12px;font-weight:bold;letter-spacing:1px">GESTÃO DE MANUTENÇÃO · QUALIDADE</p>
        <h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:normal;line-height:1.15">Plano de calibrações</h1>
        <p style="margin:9px 0 0;color:#e3eee9;font-size:15px">${dateLabel}</p>
      </td></tr>
      <tr><td style="padding:0 24px 24px">${sections || '<p style="margin:24px 0;color:#35564c">Sem calibrações vencidas ou previstas para os próximos 30 dias.</p>'}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td bgcolor="#17655a" style="border-radius:6px">
          <a href="${escapeHtml(absoluteUrl("/calibracao?alertas=verificar"))}" style="display:inline-block;padding:13px 18px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">Abrir mapa de calibrações</a>
        </td></tr></table>
      </td></tr>
    </table></div>`;
}
