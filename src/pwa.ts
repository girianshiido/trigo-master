type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
let installPrompt: InstallPrompt | null = null;
let waiting: ServiceWorker | null = null;
let reloadAfterUpdate = false;
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
export function installLabel(): string { return waiting ? 'Mise à jour prête' : isStandalone() ? 'Application installée' : 'Installer le jeu'; }
export async function install(onInstructions: (ios: boolean) => void, beforeReload: () => Promise<void>): Promise<void> {
  if (waiting) { await beforeReload(); reloadAfterUpdate = true; waiting.postMessage({ type: 'SKIP_WAITING' }); return; }
  if (installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; return; }
  onInstructions(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
}
export function initPwa(onChange: () => void): void {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event as InstallPrompt; onChange(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; onChange(); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadAfterUpdate) location.reload(); });
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
      const ready = () => { waiting = navigator.serviceWorker.controller ? registration.waiting : null; if (waiting) onChange(); };
      ready();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', ready));
      void navigator.storage?.persist?.().catch(() => false);
    }).catch(() => { /* The regular online game remains playable. */ });
  }
}
export function preventZoom(): void {
  const prevent = (event: Event) => event.preventDefault();
  for (const name of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(name, prevent, { passive: false });
  const multi = (event: TouchEvent) => { if (event.touches.length > 1) event.preventDefault(); };
  document.addEventListener('touchstart', multi, { passive: false });
  document.addEventListener('touchmove', multi, { passive: false });
}
