// Service worker: shows push notifications and routes taps back into the app.
// Payload (JSON) from the backend: { kind, title, body, url?, tag?, actions?: [{action, title}], data?: {...} }
// See docs/NOTIFICATIONS.md.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch {
    p = { title: "Global Shapers", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(p.title || "Global Shapers", {
      body: p.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: p.tag || p.kind,
      renotify: Boolean(p.tag),
      actions: p.actions || [],
      data: { url: p.url || "/", kind: p.kind, ...(p.data || {}) },
    }),
  );
});

// Tapping a notification or one of its buttons opens the app with an action in the URL;
// the app (Shell) runs it once it has loaded and cleans the URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = new URL(d.url || "/", self.location.origin);
  if (event.action) url.searchParams.set("n", event.action);
  if (d.meetingId) url.searchParams.set("meeting", d.meetingId);
  if (d.taskId) url.searchParams.set("task", d.taskId);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === url.origin);
      if (open) return open.navigate(url.href).then((w) => (w || open).focus());
      return self.clients.openWindow(url.href);
    }),
  );
});
