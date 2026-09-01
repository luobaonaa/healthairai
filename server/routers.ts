import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  clearEnvironmentalData,
  exportEnvironmentalData,
  getSavedLocations,
  getUserPreferences,
  removePushSubscription,
  removeUserLocation,
  saveFeedbackMessage,
  savePushSubscription,
  saveUserLocation,
  saveUserPreferences,
} from "./db";
import { sdk } from "./_core/sdk";
import {
  fetchAqiTrend,
  fetchLiveEnvironmentalReading,
  fetchRouteExposure,
} from "./liveEnvironment";
import { answerAirQuestion } from "./airAssistant";
import {
  reverseLocationSuggestion,
  searchLocationSuggestions,
} from "./locationSearch";
import {
  LocalAccountError,
  registerLocalAccount,
  signInLocalAccount,
} from "./localAccounts";
import { getRoadRoute } from "./roadRouting";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { pushAlertsConfigured } from "./pushAlerts";

const profileType = z.enum([
  "General",
  "Respiratory Sensitive",
  "Older Adult",
  "Child",
  "Outdoor Activity",
]);
const localCredentials = z.object({
  email: z.string().trim().email("Masukkan alamat email yang valid.").max(320),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128),
});
const localRegistration = localCredentials.extend({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
});
const airAssistantMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(12000),
});
const airAssistantContext = z.object({
  location: z.string().trim().min(1).max(240),
  profile: z.string().trim().min(1).max(120),
  aqi: z.number().min(0).max(1000),
  pm25: z.number().min(0).max(5000),
  pm10: z.number().min(0).max(5000),
  ozone: z.number().min(0).max(5000).nullable(),
  temperature: z.number().min(-100).max(100),
  humidity: z.number().min(0).max(100),
  wind: z.number().min(0).max(500),
  weather: z.string().trim().min(1).max(120),
  status: z.string().trim().min(1).max(120),
  source: z.string().trim().min(1).max(120),
  observedAt: z.string().trim().min(1).max(64).optional(),
});
const roadRouteInput = z.object({
  originLatitude: z.number().min(-90).max(90),
  originLongitude: z.number().min(-180).max(180),
  destinationLatitude: z.number().min(-90).max(90),
  destinationLongitude: z.number().min(-180).max(180),
  mode: z.enum(["walk", "motor", "car", "transit"]),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(localRegistration)
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await registerLocalAccount(input);
          const token = await sdk.createSessionToken(user.openId, {
            name: user.name ?? "Pengguna HealthAir",
          });
          ctx.res.cookie(COOKIE_NAME, token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: 1000 * 60 * 60 * 24 * 30,
          });
          return user;
        } catch (error) {
          if (
            error instanceof LocalAccountError &&
            error.code === "EMAIL_IN_USE"
          )
            throw new TRPCError({ code: "CONFLICT", message: error.message });
          throw error;
        }
      }),
    login: publicProcedure
      .input(localCredentials)
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await signInLocalAccount(input);
          const token = await sdk.createSessionToken(user.openId, {
            name: user.name ?? "Pengguna HealthAir",
          });
          ctx.res.cookie(COOKIE_NAME, token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: 1000 * 60 * 60 * 24 * 30,
          });
          return user;
        } catch (error) {
          if (error instanceof LocalAccountError)
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: error.message,
            });
          throw error;
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),
  environmental: router({
    live: publicProcedure
      .input(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
      )
      .query(({ input }) =>
        fetchLiveEnvironmentalReading(input.latitude, input.longitude)
      ),
    aqiTrend: publicProcedure
      .input(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
      )
      .query(({ input }) => fetchAqiTrend(input.latitude, input.longitude)),
    routeExposure: publicProcedure
      .input(
        z.object({
          points: z
            .array(
              z.object({
                latitude: z.number().min(-90).max(90),
                longitude: z.number().min(-180).max(180),
              })
            )
            .min(2)
            .max(8),
        })
      )
      .query(({ input }) => fetchRouteExposure(input.points)),
    roadRoute: publicProcedure
      .input(roadRouteInput)
      .query(({ input }) => getRoadRoute(input)),
    searchLocations: publicProcedure
      .input(z.object({ query: z.string().trim().min(1).max(120) }))
      .query(({ input }) => searchLocationSuggestions(input.query)),
    reverseLocation: publicProcedure
      .input(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
      )
      .mutation(({ input }) =>
        reverseLocationSuggestion(input.latitude, input.longitude)
      ),
    preferences: protectedProcedure.query(async ({ ctx }) => {
      return (
        (await getUserPreferences(ctx.user.id)) ?? {
          profileType: "General" as const,
          notificationPreference: false,
        }
      );
    }),
    savePreferences: protectedProcedure
      .input(z.object({ profileType, notificationPreference: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return saveUserPreferences(ctx.user.id, input);
      }),
    savedLocations: protectedProcedure.query(({ ctx }) =>
      getSavedLocations(ctx.user.id)
    ),
    saveLocation: protectedProcedure
      .input(
        z.object({
          label: z.string().min(1).max(160),
          address: z.string().min(1).max(320),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
      )
      .mutation(({ ctx, input }) => saveUserLocation(ctx.user.id, input)),
    removeLocation: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => removeUserLocation(ctx.user.id, input.id)),
    favoriteAlerts: protectedProcedure.query(async ({ ctx }) => {
      const favorites = await getSavedLocations(ctx.user.id);
      const readings = await Promise.all(
        favorites
          .slice(0, 5)
          .map(async favorite => ({
            favorite,
            reading: await fetchLiveEnvironmentalReading(
              favorite.latitude,
              favorite.longitude
            ),
          }))
      );
      return readings
        .filter(({ reading }) => (reading?.aqi ?? 0) > 100)
        .map(({ favorite, reading }) => ({
          id: favorite.id,
          label: favorite.label,
          address: favorite.address,
          latitude: favorite.latitude,
          longitude: favorite.longitude,
          aqi: reading!.aqi,
          status: reading!.status,
        }));
    }),
    pushConfig: publicProcedure.query(() => ({
      enabled: pushAlertsConfigured(),
      publicKey: pushAlertsConfigured() ? ENV.vapidPublicKey : null,
    })),
    subscribePush: protectedProcedure
      .input(
        z.object({
          endpoint: z.string().url().max(700),
          keys: z.object({
            p256dh: z.string().min(1).max(255),
            auth: z.string().min(1).max(255),
          }),
        })
      )
      .mutation(({ ctx, input }) =>
        savePushSubscription(ctx.user.id, {
          endpoint: input.endpoint,
          ...input.keys,
        })
      ),
    unsubscribePush: protectedProcedure
      .input(z.object({ endpoint: z.string().url().max(700) }))
      .mutation(({ ctx, input }) =>
        removePushSubscription(ctx.user.id, input.endpoint)
      ),
    exportMyData: protectedProcedure.query(({ ctx }) =>
      exportEnvironmentalData(ctx.user.id)
    ),
    clearMyEnvironmentalData: protectedProcedure.mutation(({ ctx }) =>
      clearEnvironmentalData(ctx.user.id)
    ),
  }),
  feedback: router({
    submit: protectedProcedure
      .input(
        z.object({
          message: z
            .string()
            .trim()
            .min(8, "Tulis masukan setidaknya 8 karakter.")
            .max(1000),
        })
      )
      .mutation(({ ctx, input }) =>
        saveFeedbackMessage(ctx.user.id, input.message)
      ),
  }),
  ai: router({
    chat: publicProcedure
      .input(
        z.object({
          messages: z.array(airAssistantMessage).min(1).max(10),
          context: airAssistantContext,
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await answerAirQuestion(input.messages, input.context);
        } catch (error) {
          console.error("[AI] HealthAir assistant request failed", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "HealthAir AI request failed",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
