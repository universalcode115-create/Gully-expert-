import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Optional legacy identity field retained only for data migration compatibility. */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }).default("password"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  marketplaceRole: mysqlEnum("marketplaceRole", ["customer", "service_partner"]).default("customer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userRoleEnum = mysqlEnum("userRole", ["customer", "service_partner"]);

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  label: varchar("label", { length: 120 }).notNull(),
  iconKey: varchar("iconKey", { length: 50 }).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

export const partnerProfiles = mysqlTable("partner_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  serviceId: int("serviceId").default(1).notNull(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., 'Plumber', 'Electrician', etc.
  bio: text("bio"),
  experienceYears: int("experienceYears").default(1).notNull(),
  basePrice: int("basePrice").default(500).notNull(), // in INR
  serviceRadiusKm: int("serviceRadiusKm").default(5).notNull(),
  locationName: varchar("locationName", { length: 255 }).default("New Delhi, India").notNull(),
  phone: varchar("phone", { length: 50 }),
  latitude: varchar("latitude", { length: 50 }).default("28.6139"),
  longitude: varchar("longitude", { length: 50 }).default("77.2090"),
  photoUrl: text("photoUrl"),
  pastWorkPhotos: text("pastWorkPhotos"), // JSON stringified array of URLs
  isVerified: int("isVerified").default(0).notNull(), // 1 only after real verification
  isOnline: int("isOnline").default(0).notNull(), // 1 for online/available
  ratingAvg: varchar("ratingAvg", { length: 10 }).default("0.0").notNull(),
  reviewCount: int("reviewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const jobPosts = mysqlTable("job_posts", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  serviceId: int("serviceId").default(1).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  budget: varchar("budget", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["open", "assigned", "completed", "cancelled"]).default("open").notNull(),
  assignedPartnerId: int("assignedPartnerId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull().unique(),
  partnerId: int("partnerId").notNull(),
  customerId: int("customerId").notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  rating: int("rating").notNull(), // 1-5
  comment: text("comment").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerProfile = typeof partnerProfiles.$inferSelect;
export type InsertPartnerProfile = typeof partnerProfiles.$inferInsert;
export type JobPost = typeof jobPosts.$inferSelect;
export type InsertJobPost = typeof jobPosts.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;