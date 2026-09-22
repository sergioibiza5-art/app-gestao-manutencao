export function isDeliverableEmail(email: string) {
  const value = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith(".local");
}

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app-gestao-manutencao.vercel.app").replace(/\/$/, "");
}

export function absoluteUrl(path: string) {
  return `${appBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendResendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM || "Gestão de manutenção <onboarding@resend.dev>";

  if (!apiKey || !isDeliverableEmail(to)) {
    return { sent: false };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Erro desconhecido.");
    throw new Error(`Falha no envio de email: ${response.status} ${errorText}`);
  }

  return { sent: true };
}
