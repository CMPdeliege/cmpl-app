/* Service worker minimal : permet d'installer l'app sur l'écran d'accueil.
   Aucune donnée n'est mise en cache (toujours la version la plus récente).
   Les notifications sur le téléphone seront ajoutées ici à l'étape suivante. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
