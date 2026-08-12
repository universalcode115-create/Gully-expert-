import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import type { Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";
import { getUserById } from "./db";
import { ENV } from "./_core/env";
import type { User } from "../drizzle/schema";

const scrypt = promisify(scryptCallback);
const SESSION_TTL = "30d";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function sessionSecret() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required for independent authentication.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [salt, storedHex] = encoded.split(":");
  if (!salt || !storedHex) return false;
  const stored = Buffer.from(storedHex, "hex");
  const derived = (await scrypt(password, salt, stored.length)) as Buffer;
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

export async function createSessionToken(user: User) {
  return new SignJWT({ userId: user.id, marketplaceRole: user.marketplaceRole })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(sessionSecret());
}

export async function getUserFromSessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const userId = Number(payload.userId ?? payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return (await getUserById(userId)) ?? null;
  } catch {
    return null;
  }
}

function cookieOptions(req: Request) {
  const forwarded = req.headers["x-forwarded-proto"];
  const forwardedProtocol = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
  const secure = Boolean(req.secure || forwardedProtocol === "https");
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, cookieOptions(req));
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(req), maxAge: -1 });
}
