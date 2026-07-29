import { supabase } from "../supabaseClient";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function getPushSubscriptionStatus() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? "subscribed" : Notification.permission;
}

export async function ensurePushSubscription(userId) {
  if (!pushSupported()) {
    throw new Error("Push notifications are not supported on this device.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications were not enabled.");
  }

  const publicKey = await fetchVapidPublicKey();
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    }));

  await savePushSubscription(userId, subscription);
  return subscription;
}

export async function removePushSubscription(userId) {
  if (!pushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", subscription.endpoint);

  await subscription.unsubscribe();
}

async function fetchVapidPublicKey() {
  const { data, error } = await supabase.functions.invoke("push-config");
  if (error) throw new Error(error.message || "Could not load push settings.");
  if (data?.error) throw new Error(data.error);
  if (!data?.publicKey) throw new Error("Missing VAPID public key.");
  return data.publicKey;
}

async function savePushSubscription(userId, subscription) {
  const serialized = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: serialized.endpoint,
      p256dh: serialized.keys?.p256dh,
      auth: serialized.keys?.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date(),
    },
    { onConflict: "endpoint" },
  );

  if (error) throw error;
}

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}
