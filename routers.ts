import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clearSessionCookie, createSessionToken, hashPassword, setSessionCookie, verifyPassword } from "./auth";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  completeJob,
  createJobPost,
  createReview,
  getPartnerProfileById,
  getPartnerProfileByUserId,
  getServiceByName,
  createLocalUser,
  getUserByEmail,
  getUserById,
  listCustomerJobs,
  listOpenJobs,
  listPartnerJobs,
  listPartnerProfiles,
  listReviews,
  listServices,
  respondToJob,
  setPartnerAvailability,
  updateMarketplaceRole,
  upsertPartnerProfile,
} from "./db";

const profileInput = z.object({
  fullName: z.string().min(2).max(255),
  category: z.string().min(2).max(100),
  bio: z.string().max(1000).optional(),
  experienceYears: z.number().int().min(0).max(60),
  basePrice: z.number().int().min(0).max(1000000),
  serviceRadiusKm: z.number().int().min(1).max(100),
  locationName: z.string().min(2).max(255),
  phone: z.string().min(7).max(50),
  latitude: z.string().max(50).optional(),
  longitude: z.string().max(50).optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
  pastWorkPhotos: z.array(z.string().url()).max(6).optional(),
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(z.object({ name: z.string().min(2).max(255), email: z.string().email().max(320), password: z.string().min(8).max(128), marketplaceRole: z.enum(["customer", "service_partner"]) }))
      .mutation(async ({ ctx, input }) => {
        const email = input.email.trim().toLowerCase();
        if (await getUserByEmail(email)) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
        const user = await createLocalUser({ name: input.name.trim(), email, passwordHash: await hashPassword(input.password), marketplaceRole: input.marketplaceRole });
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create the account. Check your database configuration." });
        setSessionCookie(ctx.req, ctx.res, await createSessionToken(user));
        return user;
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email.trim().toLowerCase());
        if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
        setSessionCookie(ctx.req, ctx.res, await createSessionToken(user));
        return user;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),
    setMarketplaceRole: protectedProcedure
      .input(z.object({ marketplaceRole: z.enum(["customer", "service_partner"]) }))
      .mutation(async ({ ctx, input }) => {
        await updateMarketplaceRole(ctx.user.id, input.marketplaceRole);
        return getUserById(ctx.user.id);
      }),
  }),

  services: router({
    list: publicProcedure.query(() => listServices()),
  }),

  providers: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional(), location: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional(), radiusKm: z.number().min(1).max(100).optional() }).optional())
      .query(({ input }) => listPartnerProfiles(input)),
    getById: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => (await getPartnerProfileById(input.id)) ?? null),
    reviews: publicProcedure.input(z.object({ partnerId: z.number().int().positive() })).query(({ input }) => listReviews(input.partnerId)),
  }),

  partner: router({
    me: protectedProcedure.query(async ({ ctx }) => (await getPartnerProfileByUserId(ctx.user.id)) ?? null),
    saveProfile: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
      const service = await getServiceByName(input.category);
      if (!service) throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose an active service category." });
      await updateMarketplaceRole(ctx.user.id, "service_partner");
      return upsertPartnerProfile({
        userId: ctx.user.id,
        serviceId: service.id,
        fullName: input.fullName,
        category: input.category,
        bio: input.bio ?? null,
        experienceYears: input.experienceYears,
        basePrice: input.basePrice,
        serviceRadiusKm: input.serviceRadiusKm,
        locationName: input.locationName,
        phone: input.phone,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        photoUrl: input.photoUrl || null,
        pastWorkPhotos: input.pastWorkPhotos?.length ? JSON.stringify(input.pastWorkPhotos) : null,
      });
    }),
    toggleAvailability: protectedProcedure.input(z.object({ isOnline: z.boolean() })).mutation(async ({ ctx, input }) => (await setPartnerAvailability(ctx.user.id, input.isOnline ? 1 : 0)) ?? null),
    incomingJobs: protectedProcedure.query(({ ctx }) => listPartnerJobs(ctx.user.id)),
  }),

  jobs: router({
    open: publicProcedure.input(z.object({ category: z.string().optional() }).optional()).query(({ input }) => listOpenJobs(input?.category)),
    mine: protectedProcedure.query(({ ctx }) => listCustomerJobs(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        customerName: z.string().min(2).max(255),
        customerPhone: z.string().min(7).max(50),
        category: z.string().min(2).max(100),
        title: z.string().min(3).max(255),
        description: z.string().min(10).max(2000),
        location: z.string().min(2).max(255),
        budget: z.string().min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        const service = await getServiceByName(input.category);
        if (!service) throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose an active service category." });
        const created = await createJobPost({ customerId: ctx.user.id, serviceId: service.id, ...input });
        return created ?? null;
      }),
    respond: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const updated = await respondToJob(input.id, ctx.user.id);
      if (!updated) throw new TRPCError({ code: "BAD_REQUEST", message: "Create a partner storefront before accepting a job." });
      return updated;
    }),
    complete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const updated = await completeJob(input.id, ctx.user.id);
      if (!updated) throw new TRPCError({ code: "FORBIDDEN", message: "Only the customer or assigned partner can complete this job." });
      return updated;
    }),
  }),

  reviews: router({
    create: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), partnerId: z.number().int().positive(), rating: z.number().int().min(1).max(5), comment: z.string().min(10).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        const created = await createReview({ ...input, customerId: ctx.user.id, customerName: ctx.user.name ?? "Customer" });
        if (!created) throw new TRPCError({ code: "BAD_REQUEST", message: "Only a completed job assigned to this partner can receive a review." });
        return created;
      }),
  }),
});

export type AppRouter = typeof appRouter;
