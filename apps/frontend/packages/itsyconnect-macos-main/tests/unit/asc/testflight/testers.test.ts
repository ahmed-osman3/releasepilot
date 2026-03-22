import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAscFetch = vi.fn();
const mockCacheInvalidatePrefix = vi.fn();

vi.mock("@/lib/asc/client", () => ({
  ascFetch: (...args: unknown[]) => mockAscFetch(...args),
}));

vi.mock("@/lib/cache", () => ({
  cacheInvalidatePrefix: (...args: unknown[]) => mockCacheInvalidatePrefix(...args),
}));

import {
  listBuildIndividualTesters,
  addIndividualTestersToBuild,
  removeIndividualTestersFromBuild,
  listAppBetaTesters,
  createBetaTester,
  addTestersToGroup,
  removeTestersFromGroup,
  sendBetaTesterInvitations,
} from "@/lib/asc/testflight/testers";

// ── Helpers ────────────────────────────────────────────────────────

function mockTestersResponse(
  testers: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string | null;
    inviteType?: string;
    state?: string;
  }>,
) {
  return {
    data: testers.map((t) => ({
      id: t.id,
      type: "betaTesters",
      attributes: {
        firstName: t.firstName ?? "Anonymous",
        lastName: t.lastName ?? "",
        email: t.email ?? null,
        inviteType: t.inviteType ?? "EMAIL",
        state: t.state ?? "NOT_INVITED",
      },
    })),
  };
}

// ── listBuildIndividualTesters ──────────────────────────────────────

describe("listBuildIndividualTesters", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
  });

  it("fetches testers for a build and returns normalised data", async () => {
    mockAscFetch.mockResolvedValue(
      mockTestersResponse([
        { id: "t-1", firstName: "Alice", lastName: "Smith", email: "alice@test.com", inviteType: "EMAIL", state: "ACCEPTED" },
        { id: "t-2", firstName: "Bob", lastName: "Jones", email: "bob@test.com", inviteType: "PUBLIC_LINK", state: "INSTALLED" },
      ]),
    );

    const result = await listBuildIndividualTesters("build-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "t-1",
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@test.com",
      inviteType: "EMAIL",
      state: "ACCEPTED",
      sessions: 0,
      crashes: 0,
      feedbackCount: 0,
    });
    expect(result[1]).toEqual({
      id: "t-2",
      firstName: "Bob",
      lastName: "Jones",
      email: "bob@test.com",
      inviteType: "PUBLIC_LINK",
      state: "INSTALLED",
      sessions: 0,
      crashes: 0,
      feedbackCount: 0,
    });
  });

  it("calls the correct ASC API endpoint for build testers", async () => {
    mockAscFetch.mockResolvedValue(mockTestersResponse([]));

    await listBuildIndividualTesters("build-42");

    expect(mockAscFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/builds/build-42/individualTesters"),
    );
  });

  it("handles empty response", async () => {
    mockAscFetch.mockResolvedValue({ data: [] });

    const result = await listBuildIndividualTesters("build-1");
    expect(result).toEqual([]);
  });

  it("handles single-object data (non-array) response", async () => {
    mockAscFetch.mockResolvedValue({
      data: {
        id: "t-solo",
        type: "betaTesters",
        attributes: {
          firstName: "Charlie",
          lastName: "Brown",
          email: "charlie@test.com",
          inviteType: "EMAIL",
          state: "ACCEPTED",
        },
      },
    });

    const result = await listBuildIndividualTesters("build-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t-solo");
    expect(result[0].firstName).toBe("Charlie");
  });

  it("defaults missing attributes to safe values", async () => {
    mockAscFetch.mockResolvedValue({
      data: [
        {
          id: "t-minimal",
          type: "betaTesters",
          attributes: {},
        },
      ],
    });

    const result = await listBuildIndividualTesters("build-1");
    expect(result[0]).toEqual({
      id: "t-minimal",
      firstName: "Anonymous",
      lastName: "",
      email: null,
      inviteType: "EMAIL",
      state: "NOT_INVITED",
      sessions: 0,
      crashes: 0,
      feedbackCount: 0,
    });
  });

  it("returns empty array when response.data is null (exercises falsy non-array fallback)", async () => {
    mockAscFetch.mockResolvedValue({ data: null });

    const result = await listBuildIndividualTesters("build-1");
    expect(result).toEqual([]);
  });

  it("returns empty array when response.data is undefined (exercises falsy non-array fallback)", async () => {
    mockAscFetch.mockResolvedValue({ data: undefined });

    const result = await listBuildIndividualTesters("build-1");
    expect(result).toEqual([]);
  });
});

// ── addIndividualTestersToBuild ─────────────────────────────────────

describe("addIndividualTestersToBuild", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
  });

  it("POSTs tester IDs as a relationship to the build", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await addIndividualTestersToBuild("build-1", ["t-1", "t-2", "t-3"]);

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/builds/build-1/relationships/individualTesters",
      expect.objectContaining({ method: "POST" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data).toEqual([
      { type: "betaTesters", id: "t-1" },
      { type: "betaTesters", id: "t-2" },
      { type: "betaTesters", id: "t-3" },
    ]);
  });

  it("handles a single tester ID", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await addIndividualTestersToBuild("build-1", ["t-1"]);

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data).toEqual([{ type: "betaTesters", id: "t-1" }]);
  });
});

// ── removeIndividualTestersFromBuild ────────────────────────────────

describe("removeIndividualTestersFromBuild", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
  });

  it("DELETEs tester IDs from the build relationship", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await removeIndividualTestersFromBuild("build-1", ["t-1", "t-2"]);

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/builds/build-1/relationships/individualTesters",
      expect.objectContaining({ method: "DELETE" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data).toEqual([
      { type: "betaTesters", id: "t-1" },
      { type: "betaTesters", id: "t-2" },
    ]);
  });

  it("handles a single tester ID", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await removeIndividualTestersFromBuild("build-1", ["t-only"]);

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data).toEqual([{ type: "betaTesters", id: "t-only" }]);
  });
});

// ── listAppBetaTesters ─────────────────────────────────────────────

describe("listAppBetaTesters", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
  });

  it("fetches all testers for an app and returns normalised data", async () => {
    mockAscFetch.mockResolvedValue(
      mockTestersResponse([
        { id: "t-1", firstName: "Alice", lastName: "Smith", email: "alice@test.com", state: "ACCEPTED" },
        { id: "t-2", firstName: "Bob", lastName: "Jones", email: "bob@test.com", state: "NOT_INVITED" },
      ]),
    );

    const result = await listAppBetaTesters("app-1");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("t-1");
    expect(result[0].firstName).toBe("Alice");
    expect(result[0].state).toBe("ACCEPTED");
    expect(result[1].id).toBe("t-2");
    expect(result[1].state).toBe("NOT_INVITED");
  });

  it("calls the correct ASC API endpoint with app filter", async () => {
    mockAscFetch.mockResolvedValue(mockTestersResponse([]));

    await listAppBetaTesters("app-99");

    expect(mockAscFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/betaTesters?filter[apps]=app-99"),
    );
  });

  it("handles empty response", async () => {
    mockAscFetch.mockResolvedValue({ data: [] });

    const result = await listAppBetaTesters("app-1");
    expect(result).toEqual([]);
  });

  it("handles single-object data (non-array) response", async () => {
    mockAscFetch.mockResolvedValue({
      data: {
        id: "t-solo",
        type: "betaTesters",
        attributes: {
          firstName: "Solo",
          lastName: "Tester",
          email: "solo@test.com",
          inviteType: "EMAIL",
          state: "INSTALLED",
        },
      },
    });

    const result = await listAppBetaTesters("app-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t-solo");
    expect(result[0].email).toBe("solo@test.com");
  });

  it("defaults missing attributes to safe values", async () => {
    mockAscFetch.mockResolvedValue({
      data: [
        {
          id: "t-empty",
          type: "betaTesters",
          attributes: {},
        },
      ],
    });

    const result = await listAppBetaTesters("app-1");
    expect(result[0]).toEqual({
      id: "t-empty",
      firstName: "Anonymous",
      lastName: "",
      email: null,
      inviteType: "EMAIL",
      state: "NOT_INVITED",
      sessions: 0,
      crashes: 0,
      feedbackCount: 0,
    });
  });

  it("returns empty array when response.data is null (exercises falsy non-array fallback)", async () => {
    mockAscFetch.mockResolvedValue({ data: null });

    const result = await listAppBetaTesters("app-1");
    expect(result).toEqual([]);
  });

  it("returns empty array when response.data is undefined (exercises falsy non-array fallback)", async () => {
    mockAscFetch.mockResolvedValue({ data: undefined });

    const result = await listAppBetaTesters("app-1");
    expect(result).toEqual([]);
  });
});

// ── createBetaTester ───────────────────────────────────────────────

describe("createBetaTester", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
  });

  it("POSTs a new tester with all optional fields and returns the ID", async () => {
    mockAscFetch.mockResolvedValue({ data: { id: "new-tester-1" } });

    const id = await createBetaTester("build-1", "alice@test.com", "Alice", "Smith");

    expect(id).toBe("new-tester-1");
    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaTesters",
      expect.objectContaining({ method: "POST" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("betaTesters");
    expect(body.data.attributes).toEqual({
      email: "alice@test.com",
      firstName: "Alice",
      lastName: "Smith",
    });
    expect(body.data.relationships.builds.data).toEqual([
      { type: "builds", id: "build-1" },
    ]);
  });

  it("POSTs with only email when firstName and lastName are omitted", async () => {
    mockAscFetch.mockResolvedValue({ data: { id: "new-tester-2" } });

    const id = await createBetaTester("build-1", "bob@test.com");

    expect(id).toBe("new-tester-2");

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.attributes).toEqual({ email: "bob@test.com" });
    expect(body.data.attributes.firstName).toBeUndefined();
    expect(body.data.attributes.lastName).toBeUndefined();
  });

  it("includes firstName but omits lastName when only firstName is provided", async () => {
    mockAscFetch.mockResolvedValue({ data: { id: "new-tester-3" } });

    await createBetaTester("build-1", "charlie@test.com", "Charlie");

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.attributes).toEqual({
      email: "charlie@test.com",
      firstName: "Charlie",
    });
    expect(body.data.attributes.lastName).toBeUndefined();
  });

  it("omits firstName when it is an empty string", async () => {
    mockAscFetch.mockResolvedValue({ data: { id: "new-tester-4" } });

    await createBetaTester("build-1", "dave@test.com", "", "Johnson");

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    // Empty firstName is falsy, so it should be omitted
    expect(body.data.attributes.firstName).toBeUndefined();
    expect(body.data.attributes.lastName).toBe("Johnson");
  });
});

// ── addTestersToGroup ──────────────────────────────────────────────

describe("addTestersToGroup", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("POSTs tester IDs as a relationship to the group", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await addTestersToGroup("group-1", ["t-1", "t-2"]);

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaGroups/group-1/relationships/betaTesters",
      expect.objectContaining({ method: "POST" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data).toEqual([
      { type: "betaTesters", id: "t-1" },
      { type: "betaTesters", id: "t-2" },
    ]);
  });

  it("handles a single tester ID", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await addTestersToGroup("group-1", ["t-only"]);

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data).toEqual([{ type: "betaTesters", id: "t-only" }]);
  });

  it("invalidates the tf-groups cache after adding testers", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await addTestersToGroup("group-1", ["t-1"]);

    expect(mockCacheInvalidatePrefix).toHaveBeenCalledWith("tf-groups:");
  });
});

// ── removeTestersFromGroup ─────────────────────────────────────────

describe("removeTestersFromGroup", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("DELETEs tester IDs from the group relationship", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await removeTestersFromGroup("group-1", ["t-1", "t-2"]);

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaGroups/group-1/relationships/betaTesters",
      expect.objectContaining({ method: "DELETE" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data).toEqual([
      { type: "betaTesters", id: "t-1" },
      { type: "betaTesters", id: "t-2" },
    ]);
  });

  it("handles a single tester ID", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await removeTestersFromGroup("group-1", ["t-only"]);

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data).toEqual([{ type: "betaTesters", id: "t-only" }]);
  });

  it("invalidates the tf-groups cache after removing testers", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await removeTestersFromGroup("group-1", ["t-1"]);

    expect(mockCacheInvalidatePrefix).toHaveBeenCalledWith("tf-groups:");
  });
});

// ── sendBetaTesterInvitations ──────────────────────────────────────

describe("sendBetaTesterInvitations", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
  });

  it("POSTs an invitation for each tester ID", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await sendBetaTesterInvitations("app-1", ["t-1", "t-2", "t-3"]);

    expect(mockAscFetch).toHaveBeenCalledTimes(3);

    // Verify each call sends correct relationship data
    for (let i = 0; i < 3; i++) {
      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/betaTesterInvitations",
        expect.objectContaining({ method: "POST" }),
      );
    }

    const body1 = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body1.data.type).toBe("betaTesterInvitations");
    expect(body1.data.relationships.betaTester.data).toEqual({
      type: "betaTesters",
      id: "t-1",
    });
    expect(body1.data.relationships.app.data).toEqual({
      type: "apps",
      id: "app-1",
    });

    const body2 = JSON.parse(mockAscFetch.mock.calls[1][1].body);
    expect(body2.data.relationships.betaTester.data.id).toBe("t-2");

    const body3 = JSON.parse(mockAscFetch.mock.calls[2][1].body);
    expect(body3.data.relationships.betaTester.data.id).toBe("t-3");
  });

  it("sends a single invitation for one tester", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await sendBetaTesterInvitations("app-1", ["t-solo"]);

    expect(mockAscFetch).toHaveBeenCalledTimes(1);

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.relationships.betaTester.data.id).toBe("t-solo");
    expect(body.data.relationships.app.data.id).toBe("app-1");
  });

  it("does not throw when individual invitation calls fail", async () => {
    // Uses Promise.allSettled, so individual failures should not propagate
    mockAscFetch
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(undefined);

    // Should not throw
    await expect(
      sendBetaTesterInvitations("app-1", ["t-1", "t-2", "t-3"]),
    ).resolves.toBeUndefined();

    expect(mockAscFetch).toHaveBeenCalledTimes(3);
  });

  it("handles empty tester list without making any API calls", async () => {
    await sendBetaTesterInvitations("app-1", []);

    expect(mockAscFetch).not.toHaveBeenCalled();
  });
});
