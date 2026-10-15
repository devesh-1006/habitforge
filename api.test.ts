// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getToken, request, setToken } from "./api";

describe("API client", () => {
  beforeEach(() => {
    setToken(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("sends the session token and browser time zone with protected calls", async () => {
    setToken("test-token");
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    await request("/profile");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/profile"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "X-Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      }),
    );
  });

  it("surfaces API errors and clears an expired token", async () => {
    setToken("expired-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Session expired." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(request("/profile")).rejects.toThrow("Session expired.");
    expect(getToken()).toBeNull();
  });
});
