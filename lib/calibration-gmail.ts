import nodemailer from "nodemailer";

export async function sendCalibrationGmail(to: string, subject: string, html: string, key: string) {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) throw new Error("Envio de e-mail indisponível. Falta configurar o Gmail.");

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user, pass },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
  });
  try {
    await transport.sendMail({
      from: { name: "Gestão de manutenção", address: user },
      to, subject, html, messageId: `<${key}@${user.split("@")[1]}>`,
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "SMTP";
    throw new Error(`Falha no envio de email: Gmail (${code}).`);
  } finally {
    transport.close();
  }
}
