import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"] = undefined): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("marketplace procedures", () => {
  it("rejects marketplace role changes when the visitor is not authenticated", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.setMarketplaceRole({ marketplaceRole: "customer" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("validates provider ids before querying profile details", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.providers.getById({ id: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("exposes a public provider discovery procedure", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.providers.list({ category: "All services", location: "" });
    expect(Array.isArray(result)).toBe(true);
  });
});
