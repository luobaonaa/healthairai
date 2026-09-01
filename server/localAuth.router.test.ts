import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
  registerLocalAccount: vi.fn(),
  signInLocalAccount: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: mocks.createSessionToken } }));
vi.mock("./localAccounts", () => ({
  LocalAccountError: class LocalAccountError extends Error { constructor(public code: string) { super(code); } },
  registerLocalAccount: mocks.registerLocalAccount,
  signInLocalAccount: mocks.signInLocalAccount,
}));

import { appRouter } from "./routers";

function context() {
  const cookie = vi.fn();
  return { ctx: { user: null, req: { protocol: "http", headers: {} }, res: { cookie, clearCookie: vi.fn() } } as unknown as TrpcContext, cookie };
}

describe("local auth routes", () => {
  beforeEach(() => {
    mocks.createSessionToken.mockReset().mockResolvedValue("local-session-token");
    mocks.registerLocalAccount.mockReset().mockResolvedValue({ id: 8, openId: "local_test", name: "Rani", email: "rani@example.com", loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
    mocks.signInLocalAccount.mockReset().mockResolvedValue({ id: 8, openId: "local_test", name: "Rani", email: "rani@example.com", loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
  });

  it("registers a local account and issues a localhost-compatible session cookie", async () => {
    const { ctx, cookie } = context();
    const result = await appRouter.createCaller(ctx).auth.register({ name: "Rani", email: "RANI@Example.com", password: "AmanSekali123" });
    expect(result).toMatchObject({ openId: "local_test", loginMethod: "local" });
    expect(mocks.registerLocalAccount).toHaveBeenCalledWith({ name: "Rani", email: "RANI@Example.com", password: "AmanSekali123" });
    expect(cookie).toHaveBeenCalledWith(expect.any(String), "local-session-token", expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: false }));
  });

  it("logs in an existing local account and issues a session cookie", async () => {
    const { ctx, cookie } = context();
    await appRouter.createCaller(ctx).auth.login({ email: "rani@example.com", password: "AmanSekali123" });
    expect(mocks.signInLocalAccount).toHaveBeenCalledWith({ email: "rani@example.com", password: "AmanSekali123" });
    expect(cookie).toHaveBeenCalledTimes(1);
  });
});
