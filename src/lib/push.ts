// Browser side of push notifications: service worker, permission, subscription.
// The backend stores the subscription and sends the pushes (docs/NOTIFICATIONS.md).

import { api, backendEnabled } from "./backend";
import type { NotifyCategory } from "./notifications";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushState = "unsupported" | "needs-home-screen" | "default" | "granted" | "denied";

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "needs-home-screen";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushState;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Ask permission (must run inside a click), subscribe, and hand the subscription to the backend. */
export async function enablePush(categories: Record<NotifyCategory, boolean>): Promise<PushState> {
  const state = pushState();
  if (state === "unsupported" || state === "needs-home-screen") return state;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushState;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  if (VAPID) {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource }));
    if (backendEnabled) await api.savePushSubscription(sub.toJSON(), categories);
  }
  return "granted";
}

export async function updatePushCategories(categories: Record<NotifyCategory, boolean>): Promise<void> {
  if (!backendEnabled || pushState() !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await api.savePushSubscription(sub.toJSON(), categories);
}

/** A local test notification through the service worker, no server needed. */
export async function testNotification(title: string, body: string): Promise<boolean> {
  if (pushState() !== "granted") return false;
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await reg.showNotification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "test" });
  return true;
}
