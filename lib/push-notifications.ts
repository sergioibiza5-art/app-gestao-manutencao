import type { PushSubscription as WebPushSubscription } from "web-push";

import { getPrisma } from "@/lib/prisma";

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

type PushNotificationResult = {
  sent: number;
  skipped: number;
  disabled: number;
};

function pushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:manutencao@localhost";

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function pushStatusCode(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : 0;
}

export async function sendPushNotifications(
  recipientIds: string[],
  payload: PushNotificationPayload,
): Promise<PushNotificationResult> {
  const uniqueRecipientIds = [...new Set(recipientIds.filter(Boolean))];
  const result: PushNotificationResult = { sent: 0, skipped: 0, disabled: 0 };
  const config = pushConfig();

  if (!config || uniqueRecipientIds.length === 0) {
    result.skipped = uniqueRecipientIds.length;
    return result;
  }

  const prisma = getPrisma();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { active: true, userId: { in: uniqueRecipientIds } },
  });

  if (subscriptions.length === 0) {
    result.skipped = uniqueRecipientIds.length;
    return result;
  }

  const webPushModule = await import("web-push");
  const webPush = webPushModule.default ?? webPushModule;
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const webPushSubscription: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      try {
        await webPush.sendNotification(webPushSubscription, JSON.stringify(payload));
        result.sent += 1;
      } catch (error) {
        const statusCode = pushStatusCode(error);

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.updateMany({
            where: { endpoint: subscription.endpoint },
            data: { active: false },
          });
          result.disabled += 1;
        } else {
          result.skipped += 1;
        }
      }
    }),
  );

  return result;
}
