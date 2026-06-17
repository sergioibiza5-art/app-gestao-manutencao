export async function sendTelegramMessage(message: string, chatIds?: string[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;
  const recipients = chatIds && chatIds.length > 0 ? [...new Set(chatIds)] : defaultChatId ? [defaultChatId] : [];

  if (!token || recipients.length === 0) {
    console.warn("Telegram não configurado.");
    return;
  }

  try {
    await Promise.all(
      recipients.map((chatId) =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }),
      ),
    );
  } catch (error) {
    console.error("Erro ao enviar Telegram:", error);
  }
}
