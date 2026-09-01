import webpush from "web-push";
import { ENV } from "./_core/env";
import { getPushSubscriptions, getSavedLocations, getUserPreferences, markPushAlertSent, removePushSubscriptionByEndpoint } from "./db";
import { fetchLiveEnvironmentalReading } from "./liveEnvironment";

const alertIntervalMs = 5 * 60 * 1000;
const repeatCooldownMs = 6 * 60 * 60 * 1000;

export function pushAlertsConfigured() {
  return Boolean(ENV.vapidPublicKey && ENV.vapidPrivateKey && ENV.vapidSubject);
}

function thresholdForProfile(profile: string | undefined) {
  return profile === "Respiratory Sensitive" || profile === "Older Adult" || profile === "Child" ? 75 : 100;
}

function shouldSendAlert(subscription: { lastAlertAqi: number | null; lastAlertAt: Date | null }, aqi: number) {
  if (!subscription.lastAlertAt) return true;
  const cooldownPassed = Date.now() - subscription.lastAlertAt.getTime() >= repeatCooldownMs;
  const meaningfullyWorse = aqi >= (subscription.lastAlertAqi ?? 0) + 25;
  return cooldownPassed || meaningfullyWorse;
}

export async function checkAndSendAirQualityAlerts() {
  if (!pushAlertsConfigured()) return { checked: 0, sent: 0, configured: false };
  webpush.setVapidDetails(ENV.vapidSubject, ENV.vapidPublicKey, ENV.vapidPrivateKey);
  const subscriptions = await getPushSubscriptions();
  const byUser = new Map<number, typeof subscriptions>();
  subscriptions.forEach(subscription => byUser.set(subscription.userId, [...(byUser.get(subscription.userId) ?? []), subscription]));
  let sent = 0;

  for (const [userId, userSubscriptions] of Array.from(byUser.entries())) {
    const [preferences, favorites] = await Promise.all([getUserPreferences(userId), getSavedLocations(userId)]);
    if (!preferences?.notificationPreference || favorites.length === 0) continue;
    const readings = await Promise.all(favorites.slice(0, 5).map(async location => ({ location, reading: await fetchLiveEnvironmentalReading(location.latitude, location.longitude) })));
    const highest = readings.filter(item => item.reading).sort((a, b) => (b.reading?.aqi ?? 0) - (a.reading?.aqi ?? 0))[0];
    if (!highest?.reading || highest.reading.aqi <= thresholdForProfile(preferences.profileType)) continue;

    const payload = JSON.stringify({
      title: `${highest.location.label} perlu diperhatikan`,
      body: `AQI ${highest.reading.aqi} · ${highest.reading.status}. Periksa kondisi sebelum beraktivitas.`,
      url: `/explore?lat=${highest.location.latitude}&lng=${highest.location.longitude}`,
      tag: `healthair-${highest.location.id}`,
    });
    for (const subscription of userSubscriptions) {
      if (!shouldSendAlert(subscription, highest.reading.aqi)) continue;
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 900, urgency: "high" });
        await markPushAlertSent(subscription.id, highest.reading.aqi);
        sent += 1;
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await removePushSubscriptionByEndpoint(subscription.endpoint);
        else console.warn("[Push] Failed to deliver an air-quality alert", statusCode || "unknown error");
      }
    }
  }
  return { checked: subscriptions.length, sent, configured: true };
}

export function startAirQualityPushScheduler() {
  if (!pushAlertsConfigured()) {
    console.warn("[Push] Background alerts are disabled until VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are configured.");
    return () => undefined;
  }
  const run = () => checkAndSendAirQualityAlerts().catch(error => console.warn("[Push] Background alert check failed", error));
  const firstRun = setTimeout(run, 30_000);
  const interval = setInterval(run, alertIntervalMs);
  return () => { clearTimeout(firstRun); clearInterval(interval); };
}
