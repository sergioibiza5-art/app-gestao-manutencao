"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellRing } from "lucide-react";

import { savePushSubscription } from "@/app/actions";

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

export function PushNotificationToggle({ vapidPublicKey }: PushNotificationToggleProps) {
  const [status, setStatus] = useState<PushStatus>("idle");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function checkCurrentSubscription() {
      if (!vapidPublicKey) {
        setStatus("missing");
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
          setStatus("active");
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
      return;
    }

    if (!browserSupportsPush()) {
      setStatus("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      setStatus("blocked");
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

    const payload = subscription.toJSON();

    startTransition(async () => {
      const result = await savePushSubscription({
        endpoint: payload.endpoint,
        keys: {
          p256dh: payload.keys?.p256dh,
          auth: payload.keys?.auth,
        },
        userAgent: navigator.userAgent,
      });

      setStatus(result.ok ? "active" : "unsupported");
    });
  }

  const active = status === "active";

  const title =
    status === "missing"
      ? "Configura as chaves VAPID para ativar push"
      : status === "blocked"
        ? "Permissão de notificações bloqueada"
        : status === "unsupported"
          ? "Este browser não suporta notificações push"
          : active
            ? "Alertas ativos neste dispositivo"
            : "Ativar alertas de tickets";

  const Icon = active ? BellRing : Bell;

  return (
    <button
      type="button"
      onClick={enablePush}
      disabled={isPending || active}
      title={title}
      aria-label={title}
      className={`hidden h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition md:inline-flex ${
        active
          ? "border-teal-300/45 bg-teal-300/10 text-teal-200"
          : "border-zinc-800 bg-zinc-950/70 text-zinc-200 hover:border-teal-300/50 hover:text-teal-200"
      }`}
    >
      <Icon size={18} />
      <span>{isPending ? "A ativar" : active ? "Alertas ativos" : "Alertas"}</span>
    </button>
  );
}