export type SerializablePushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(Array.from(raw).map(character => character.charCodeAt(0)));
}

export async function registerHealthAirServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function notificationSupport() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export async function subscribeToBackgroundAlerts(publicKey: string): Promise<SerializablePushSubscription> {
  if (!notificationSupport()) throw new Error("Browser ini belum mendukung notifikasi latar belakang.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Izin notifikasi belum diberikan.");
  const registration = await registerHealthAirServiceWorker();
  if (!registration) throw new Error("Service worker tidak tersedia.");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Langganan notifikasi tidak lengkap.");
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

export async function unsubscribeFromBackgroundAlerts() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

export async function showImmediateAirAlert(title: string, body: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registration = await registerHealthAirServiceWorker();
  await registration?.showNotification(title, { body, tag, icon: "/assets/healthair-logo-transparent.png", badge: "/assets/healthair-logo-transparent-192.png", data: { url: "/explore" } });
}
