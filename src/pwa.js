export function registerPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(async (registrations) => {
        const hadController = Boolean(navigator.serviceWorker.controller);
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if (hadController && registrations.length && window.sessionStorage.getItem("service-worker-cleared") !== "true") {
          window.sessionStorage.setItem("service-worker-cleared", "true");
          window.location.reload();
        }
      })
      .catch(() => {});
  }
  if ("caches" in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
}
