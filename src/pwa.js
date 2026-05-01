import { registerSW } from "virtual:pwa-register";

export function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  registerSW({ immediate: true });
}
