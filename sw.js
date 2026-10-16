/* Service worker : permet d'installer l'app sur l'écran d'accueil et de recevoir les notifications push.
   Aucune donnée n'est mise en cache (toujours la version la plus récente).
   Les notifications ne contiennent jamais d'information médicale. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }
  const jobs = [self.registration.showNotification(d.title || "Centre Médical Prince de Liège", {
    body: d.body || "",
    icon: "icon-192.png",
    tag: d.tag || "cmpl",
    renotify: true,
    data: { url: d.url || "./" }
  })];
  // chiffre sur l'icône de l'app (iPhone écran d'accueil, ordinateur avec app installée)
  const nav = self.navigator;
  if (typeof d.badge === "number" && nav && nav.setAppBadge) {
    jobs.push((d.badge > 0 ? nav.setAppBadge(d.badge) : nav.clearAppBadge()).catch(() => {}));
  }
  e.waitUntil(Promise.all(jobs));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
