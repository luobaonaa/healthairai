import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2";
import { InsertUser, feedbackMessages, localAccounts, pushSubscriptions, savedLocations, userPreferences, users } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import { ensureDatabaseSchema } from "./schema-bootstrap.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

function createDatabasePool(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const caCertificate = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n").trim();
  const sslRequired =
    url.searchParams.get("ssl-mode")?.toUpperCase() === "REQUIRED" ||
    url.searchParams.get("sslmode")?.toLowerCase() === "require" ||
    process.env.DATABASE_SSL === "true" ||
    url.hostname.endsWith(".aivencloud.com");

  return createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: sslRequired
      ? {
          ca: caCertificate || undefined,
          rejectUnauthorized: Boolean(caCertificate),
        }
      : undefined,
    waitForConnections: true,
    connectionLimit: 5,
  });
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createDatabasePool(process.env.DATABASE_URL);
      await ensureDatabaseSchema(_pool);
      _db = drizzle(_pool);
    }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getLocalAccountByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: users.id, openId: users.openId, name: users.name, email: users.email, loginMethod: users.loginMethod, role: users.role,
    createdAt: users.createdAt, updatedAt: users.updatedAt, lastSignedIn: users.lastSignedIn, passwordHash: localAccounts.passwordHash,
  }).from(localAccounts).innerJoin(users, eq(localAccounts.userId, users.id)).where(eq(localAccounts.email, email)).limit(1);
  const account = result[0];
  if (!account) return undefined;
  const { passwordHash, ...user } = account;
  return { user, passwordHash };
}

export async function createLocalAccountUser(values: { openId: string; name: string; email: string; passwordHash: string; }) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Periksa DATABASE_URL lokal.");
  await db.insert(users).values({ openId: values.openId, name: values.name, email: values.email, loginMethod: "local", role: "user", lastSignedIn: new Date() });
  const user = await getUserByOpenId(values.openId);
  if (!user) throw new Error("Akun lokal tidak dapat dibuat.");
  await db.insert(localAccounts).values({ userId: user.id, email: values.email, passwordHash: values.passwordHash });
  return user;
}

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result[0];
}

export async function saveUserPreferences(userId: number, values: { profileType: "General" | "Respiratory Sensitive" | "Older Adult" | "Child" | "Outdoor Activity"; notificationPreference: boolean; }) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.insert(userPreferences).values({ userId, ...values }).onDuplicateKeyUpdate({ set: { ...values } });
  return getUserPreferences(userId);
}

export async function getSavedLocations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedLocations).where(eq(savedLocations.userId, userId)).orderBy(desc(savedLocations.createdAt));
}

export async function saveUserLocation(userId: number, values: { label: string; address: string; latitude: number; longitude: number; }) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  const existing = await db.select({ id: savedLocations.id }).from(savedLocations).where(and(eq(savedLocations.userId, userId), eq(savedLocations.latitude, values.latitude), eq(savedLocations.longitude, values.longitude))).limit(1);
  if (existing[0]) return { saved: true, alreadySaved: true } as const;
  await db.insert(savedLocations).values({ userId, ...values });
  return { saved: true } as const;
}

export async function removeUserLocation(userId: number, locationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.delete(savedLocations).where(and(eq(savedLocations.id, locationId), eq(savedLocations.userId, userId)));
  return { removed: true } as const;
}

export async function savePushSubscription(userId: number, subscription: { endpoint: string; p256dh: string; auth: string; }) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.insert(pushSubscriptions).values({ userId, ...subscription }).onDuplicateKeyUpdate({ set: { userId, p256dh: subscription.p256dh, auth: subscription.auth } });
  return { subscribed: true } as const;
}

export async function removePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  return { subscribed: false } as const;
}

export async function removePushSubscriptionByEndpoint(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getPushSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscriptions);
}

export async function markPushAlertSent(id: number, aqi: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(pushSubscriptions).set({ lastAlertAqi: aqi, lastAlertAt: new Date() }).where(eq(pushSubscriptions.id, id));
}

export async function exportEnvironmentalData(userId: number) {
  const [preferences, locations] = await Promise.all([getUserPreferences(userId), getSavedLocations(userId)]);
  return { exportedAt: new Date().toISOString(), preferences: preferences ?? null, savedLocations: locations };
}

export async function clearEnvironmentalData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.transaction(async tx => {
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    await tx.delete(savedLocations).where(eq(savedLocations.userId, userId));
    await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
  });
  return { cleared: true } as const;
}

export async function saveFeedbackMessage(userId: number, message: string) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.insert(feedbackMessages).values({ userId, message });
  return { submitted: true } as const;
}
