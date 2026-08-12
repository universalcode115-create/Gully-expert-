import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse } from "cookie";
import type { User } from "../../drizzle/schema";
import { getUserFromSessionToken } from "../auth";
import { COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const cookies = parse(opts.req.headers.cookie ?? "");
  const bearer = opts.req.headers.authorization?.startsWith("Bearer ")
    ? opts.req.headers.authorization.slice("Bearer ".length)
    : undefined;
  const user = await getUserFromSessionToken(cookies[COOKIE_NAME] ?? bearer);
  return { req: opts.req, res: opts.res, user };
}
