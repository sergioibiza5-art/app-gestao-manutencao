self.addEventListener("push", (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "Novo ticket", body: event.data.text() };
    }
  }

  const title = data.title || "Alerta de manutenção";
  const options = {
    body: data.body || "Existe um novo alerta para consultar.",
    tag: data.tag || "alerta-manutencao",
    data: {
      url: data.url || "/plano",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/plano";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }

      return undefined;
    }),
  );
});
