self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() || {};
  const title = payload.title || "MoveCircle";
  const options = {
    body: payload.body || "Time to log your meals and activity for today.",
    icon: "/pwa-icon.svg",
    badge: "/maskable-icon.svg",
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existingClient = clientList.find((client) => client.url === targetUrl);
        if (existingClient) return existingClient.focus();
        return self.clients.openWindow(targetUrl);
      }),
  );
});
