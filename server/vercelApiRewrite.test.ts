import { describe, expect, it } from "vitest";
import { restoreRewrittenApiPath } from "../api/index";

describe("Vercel API rewrite", () => {
  it("restores the original Express API pathname and keeps tRPC query data", () => {
    const input = encodeURIComponent(JSON.stringify({ json: { latitude: -6.2, longitude: 106.8 } }));
    const result = restoreRewrittenApiPath(`/api?path=trpc/environmental.live&batch=1&input=${input}`);

    expect(result).toBe(`/api/trpc/environmental.live?batch=1&input=${input}`);
  });

  it("leaves direct local API requests unchanged", () => {
    expect(restoreRewrittenApiPath("/api/health")).toBe("/api/health");
  });
});
