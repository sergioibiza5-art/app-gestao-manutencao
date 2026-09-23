"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellRing } from "lucide-react";

import { savePushSubscription, sendTestPushNotification } from "@/app/actions";

type PushNotificationToggleProps = {
  vapidPublicKey?: string;
};

type PushStatus = "idle" | "active" | "blocked" | "unsupported" | "missing";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function browserSupportsPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isAppleTabletOrPhone() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function unsupportedPushMessage() {
  if (isAppleTabletOrPhone() && !isStandaloneApp()) {
    return "No iPad, abre esta app pelo ícone no ecrã principal. Se ainda não existir, abre no Safari, Partilhar, Adicionar ao ecrã principal.";
  }

  return "Este navegador não suporta alertas push neste modo.";
}

export function PushNotificationToggle({ vapidPublicKey }: PushNotificationToggleProps) {
  const [status, setStatus] = useState<PushStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();

  async function saveBrowserSubscription(subscription: PushSubscription) {
    const payload = subscription.toJSON();

    return savePushSubscription({
      endpoint: payload.endpoint,
      keys: {
        p256dh: payload.keys?.p256dh,
        auth: payload.keys?.auth,
      },
      userAgent: navigator.userAgent,
    });
  }

  useEffect(() => {
    async function checkCurrentSubscription() {
      if (!vapidPublicKey) {
        setStatus("missing");
        return;
      }

      if (isAppleTabletOrPhone() && !isStandaloneApp()) {
        setStatus("unsupported");
        return;
      }

      if (!browserSupportsPush()) {
        setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setStatus("blocked");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const result = await saveBrowserSubscription(subscription);
          setStatus(result.ok ? "active" : "idle");
        }
      } catch {
        setStatus("idle");
      }
    }

    checkCurrentSubscription();
  }, [vapidPublicKey]);

  async function enablePush() {
    if (!vapidPublicKey) {
      setStatus("missing");
      setTestMessage("Faltam chaves de alertas na configuração da app.");
      return;
    }

    if (isAppleTabletOrPhone() && !isStandaloneApp()) {
      setStatus("unsupported");
      setTestMessage(unsupportedPushMessage());
      return;
    }

    if (!browserSupportsPush()) {
      setStatus("unsupported");
      setTestMessage(unsupportedPushMessage());
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("blocked");
      setTestMessage("As notificações estão bloqueadas no navegador. Tens de permitir nas definições do site.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      setStatus("blocked");
      setTestMessage("Não foi dada permissão para enviar alertas neste dispositivo.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const existing = await registration.pushManager.getSubscription();

    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    startTransition(async () => {
      const result = await saveBrowserSubscription(subscription);

      setStatus(result.ok ? "active" : "unsupported");
      setTestMessage(result.ok ? "Alertas ativos neste dispositivo." : "");
    });
  }

  function sendTest() {
    setTestMessage("");
    startTestTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const saveResult = await saveBrowserSubscription(subscription);
          if (!saveResult.ok) {
            setStatus("idle");
            setTestMessage("Carrega primeiro em Alertas para ativar este dispositivo.");
            return;
          }
          setStatus("active");
        }
      } catch {
        setTestMessage("Não consegui confirmar os alertas neste dispositivo.");
        return;
      }

      const result = await sendTestPushNotification();
      setTestMessage(result.message);
    });
  }

  const active = status === "active";

  const title =
    status === "missing"
      ? "Configura as chaves VAPID para ativar alertas"
      : status === "blocked"
        ? "Permissão de notificações bloqueada"
        : status === "unsupported"
          ? "Este browser não suporta notificações push"
          : active
            ? "Alertas ativos neste dispositivo"
            : "Ativar alertas neste dispositivo";

  const Icon = active ? BellRing : Bell;

  return (
    <span className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={enablePush}
        disabled={isPending || active}
        title={title}
        aria-label={title}
        className={`inline-flex h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
          active
            ? "border-teal-300/45 bg-teal-300/10 text-teal-200"
            : "border-zinc-800 bg-zinc-950/70 text-zinc-200 hover:border-teal-300/50 hover:text-teal-200"
        }`}
      >
        <Icon size={18} />
        <span className="hidden sm:inline">{isPending ? "A ativar" : active ? "Alertas ativos" : "Alertas"}</span>
      </button>
      {active ? (
        <button
          type="button"
          onClick={sendTest}
          disabled={isTesting}
          title="Enviar alerta de teste para este utilizador"
          className="hidden h-11 items-center rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 text-sm font-semibold text-zinc-200 transition hover:border-teal-300/50 hover:text-teal-200 md:inline-flex"
        >
          {isTesting ? "A enviar" : "Testar"}
        </button>
      ) : null}
      {testMessage ? (
        <span className="absolute right-0 top-12 z-40 w-64 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 shadow-xl">
          {testMessage}
        </span>
      ) : null}
    </span>
  );
}
