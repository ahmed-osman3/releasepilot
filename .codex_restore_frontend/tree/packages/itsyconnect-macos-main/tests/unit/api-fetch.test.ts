import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch } from "@/lib/api-fetch";

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(status: number, body?: unknown, headers?: HeadersInit) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        body !== undefined ? JSON.stringify(body) : null,
        { status, headers },
      ),
    );
  }

  it("returns parsed JSON for 200", async () => {
    mockFetch(200, { id: "abc", name: "Test" });
    const result = await apiFetch("/api/test");
    expect(result).toEqual({ id: "abc", name: "Test" });
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/test", undefined);
  });

  it("returns null for 204", async () => {
    mockFetch(204);
    const result = await apiFetch("/api/test");
    expect(result).toBeNull();
  });

  it("passes options through to fetch", async () => {
    mockFetch(200, { ok: true });
    await apiFetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: 1 }),
    });
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: 1 }),
    });
  });

  it("throws with body.error for 4xx", async () => {
    mockFetch(422, { error: "Validation failed" });
    await expect(apiFetch("/api/test")).rejects.toThrow("Validation failed");
  });

  it("throws with body.error for 5xx", async () => {
    mockFetch(500, { error: "Internal server error" });
    await expect(apiFetch("/api/test")).rejects.toThrow("Internal server error");
  });

  it("throws generic fallback for unparseable error body", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("not json", { status: 500 }),
    );
    await expect(apiFetch("/api/test")).rejects.toThrow("Request failed (500)");
  });

  it("supports generic type parameter", async () => {
    mockFetch(200, { count: 42 });
    const result = await apiFetch<{ count: number }>("/api/count");
    expect(result.count).toBe(42);
  });
});
