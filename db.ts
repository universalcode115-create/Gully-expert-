import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertJobPost,
  InsertPartnerProfile,
  InsertReview,
  InsertUser,
  JobPost,
  PartnerProfile,
  Review,
  Service,
  User,
  jobPosts,
  partnerProfiles,
  reviews,
  services,
  users,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
    updateSet.lastSignedIn = new Date();
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function createLocalUser(input: { name: string; email: string; passwordHash: string; marketplaceRole: "customer" | "service_partner" }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(users).values({
    openId: null,
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    loginMethod: "password",
    marketplaceRole: input.marketplaceRole,
    role: "user",
  });
  return getUserByEmail(input.email);
}

export async function updateMarketplaceRole(id: number, marketplaceRole: "customer" | "service_partner") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ marketplaceRole, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function getServiceByName(name: string): Promise<Service | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.name, name)).limit(1);
  return result[0];
}

export async function listServices(): Promise<Service[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services).where(eq(services.isActive, 1));
}

export async function getPartnerProfileByUserId(userId: number): Promise<PartnerProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(partnerProfiles).where(eq(partnerProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function getPartnerProfileById(id: number): Promise<PartnerProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(partnerProfiles).where(eq(partnerProfiles.id, id)).limit(1);
  return result[0];
}

const distanceBetweenKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const earthRadius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export async function listPartnerProfiles(filters?: { category?: string; location?: string; latitude?: number; longitude?: number; radiusKm?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.category && filters.category !== "All services") conditions.push(eq(partnerProfiles.category, filters.category));
  if (filters?.location && filters.location.trim()) {
    conditions.push(or(like(partnerProfiles.locationName, `%${filters.location}%`), like(partnerProfiles.category, `%${filters.location}%`), like(partnerProfiles.fullName, `%${filters.location}%`)));
  }
  const rows = conditions.length
    ? await db.select().from(partnerProfiles).where(and(...conditions)).orderBy(desc(partnerProfiles.isOnline), desc(partnerProfiles.ratingAvg))
    : await db.select().from(partnerProfiles).orderBy(desc(partnerProfiles.isOnline), desc(partnerProfiles.ratingAvg));

  if (filters?.latitude === undefined || filters.longitude === undefined) return rows;
  const radius = filters.radiusKm ?? 25;
  return rows
    .map(row => {
      const lat = Number(row.latitude);
      const lon = Number(row.longitude);
      const distanceKm = Number.isFinite(lat) && Number.isFinite(lon) ? distanceBetweenKm(filters.latitude!, filters.longitude!, lat, lon) : null;
      return { ...row, distanceKm };
    })
    .filter(row => row.distanceKm === null || row.distanceKm <= radius)
    .sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
}

export async function upsertPartnerProfile(input: InsertPartnerProfile) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(partnerProfiles).values(input).onDuplicateKeyUpdate({
    set: {
      serviceId: input.serviceId,
      fullName: input.fullName,
      category: input.category,
      bio: input.bio ?? null,
      experienceYears: input.experienceYears,
      basePrice: input.basePrice,
      serviceRadiusKm: input.serviceRadiusKm,
      locationName: input.locationName,
      phone: input.phone ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      photoUrl: input.photoUrl ?? null,
      pastWorkPhotos: input.pastWorkPhotos ?? null,
      updatedAt: new Date(),
    },
  });
  return getPartnerProfileByUserId(input.userId);
}

export async function setPartnerAvailability(userId: number, isOnline: number) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(partnerProfiles).set({ isOnline, updatedAt: new Date() }).where(eq(partnerProfiles.userId, userId));
  return getPartnerProfileByUserId(userId);
}

export async function createJobPost(input: InsertJobPost) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(jobPosts).values(input);
  return getJobPostById(Number(result[0].insertId));
}

export async function getJobPostById(id: number): Promise<JobPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobPosts).where(eq(jobPosts.id, id)).limit(1);
  return result[0];
}

export async function listOpenJobs(category?: string) {
  const db = await getDb();
  if (!db) return [] as JobPost[];
  const conditions = [eq(jobPosts.status, "open")];
  if (category && category !== "All services") conditions.push(eq(jobPosts.category, category));
  return db.select().from(jobPosts).where(and(...conditions)).orderBy(desc(jobPosts.createdAt));
}

export async function listCustomerJobs(customerId: number) {
  const db = await getDb();
  if (!db) return [] as JobPost[];
  return db.select().from(jobPosts).where(eq(jobPosts.customerId, customerId)).orderBy(desc(jobPosts.createdAt));
}

export async function listPartnerJobs(userId: number) {
  const profile = await getPartnerProfileByUserId(userId);
  if (!profile) return [] as JobPost[];
  return listOpenJobs(profile.category);
}

export async function respondToJob(id: number, partnerUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const profile = await getPartnerProfileByUserId(partnerUserId);
  if (!profile) return undefined;
  await db.update(jobPosts).set({ assignedPartnerId: profile.id, status: "assigned" }).where(and(eq(jobPosts.id, id), eq(jobPosts.status, "open")));
  return getJobPostById(id);
}

export async function completeJob(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const job = await getJobPostById(id);
  if (!job) return undefined;
  const profile = await getPartnerProfileByUserId(userId);
  const isCustomer = job.customerId === userId;
  const isAssignedPartner = Boolean(profile && job.assignedPartnerId === profile.id);
  if (!isCustomer && !isAssignedPartner) return undefined;
  await db.update(jobPosts).set({ status: "completed" }).where(eq(jobPosts.id, id));
  return getJobPostById(id);
}

export async function createReview(input: InsertReview) {
  const db = await getDb();
  if (!db) return undefined;
  const job = await getJobPostById(input.jobId);
  if (!job || job.customerId !== input.customerId || job.status !== "completed" || job.assignedPartnerId !== input.partnerId) return undefined;
  await db.insert(reviews).values(input);
  const partnerReviews = await db.select().from(reviews).where(eq(reviews.partnerId, input.partnerId));
  const avg = partnerReviews.reduce((sum, review) => sum + review.rating, 0) / Math.max(partnerReviews.length, 1);
  await db.update(partnerProfiles).set({ ratingAvg: avg.toFixed(1), reviewCount: partnerReviews.length, updatedAt: new Date() }).where(eq(partnerProfiles.id, input.partnerId));
  return input;
}

export async function listReviews(partnerId: number): Promise<Review[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.partnerId, partnerId)).orderBy(desc(reviews.createdAt));
}
