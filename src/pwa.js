import { registerSW } from "virtual:pwa-register";

export function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      registration?.update();
      window.setInterval(() => registration?.update(), 60 * 60 * 1000);
    },
  });
}
