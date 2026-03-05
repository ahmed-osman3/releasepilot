import { ascFetch } from "../client";
import { cacheInvalidatePrefix } from "@/lib/cache";
import { normalizeArray } from "../helpers";
import type { TFTester, AscJsonApiResponse } from "./types";

// ── Individual testers on builds ──────────────────────────────────

export async function listBuildIndividualTesters(
  buildId: string,
): Promise<TFTester[]> {
  const response = await ascFetch<AscJsonApiResponse>(
    `/v1/builds/${buildId}/individualTesters?fields[betaTesters]=firstName,lastName,email,inviteType,state&limit=200`,
  );

  const dataArr = normalizeArray(response.data);

  return dataArr.map((t) => {
    const attrs = t.attributes;
    return {
      id: t.id,
      firstName: (attrs.firstName as string) ?? "Anonymous",
      lastName: (attrs.lastName as string) ?? "",
      email: (attrs.email as string) ?? null,
      inviteType: (attrs.inviteType as string) ?? "EMAIL",
      state: (attrs.state as string) ?? "NOT_INVITED",
      sessions: 0,
      crashes: 0,
      feedbackCount: 0,
    };
  });
}

export async function addIndividualTestersToBuild(
  buildId: string,
  testerIds: string[],
): Promise<void> {
  await ascFetch(`/v1/builds/${buildId}/relationships/individualTesters`, {
    method: "POST",
    body: JSON.stringify({
      data: testerIds.map((id) => ({ type: "betaTesters", id })),
    }),
  });
}

export async function removeIndividualTestersFromBuild(
  buildId: string,
  testerIds: string[],
): Promise<void> {
  await ascFetch(`/v1/builds/${buildId}/relationships/individualTesters`, {
    method: "DELETE",
    body: JSON.stringify({
      data: testerIds.map((id) => ({ type: "betaTesters", id })),
    }),
  });
}

// ── App-level beta testers ────────────────────────────────────────

export async function listAppBetaTesters(
  appId: string,
): Promise<TFTester[]> {
  const response = await ascFetch<AscJsonApiResponse>(
    `/v1/betaTesters?filter[apps]=${appId}&fields[betaTesters]=firstName,lastName,email,inviteType,state&limit=200`,
  );

  const dataArr = normalizeArray(response.data);

  return dataArr.map((t) => {
    const attrs = t.attributes;
    return {
      id: t.id,
      firstName: (attrs.firstName as string) ?? "Anonymous",
      lastName: (attrs.lastName as string) ?? "",
      email: (attrs.email as string) ?? null,
      inviteType: (attrs.inviteType as string) ?? "EMAIL",
      state: (attrs.state as string) ?? "NOT_INVITED",
      sessions: 0,
      crashes: 0,
      feedbackCount: 0,
    };
  });
}

export async function createBetaTester(
  buildId: string,
  email: string,
  firstName?: string,
  lastName?: string,
): Promise<string> {
  const attributes: Record<string, string> = { email };
  if (firstName) attributes.firstName = firstName;
  if (lastName) attributes.lastName = lastName;

  const response = await ascFetch<{ data: { id: string } }>(
    `/v1/betaTesters`,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "betaTesters",
          attributes,
          relationships: {
            builds: {
              data: [{ type: "builds", id: buildId }],
            },
          },
        },
      }),
    },
  );

  return response.data.id;
}

// ── Group-level tester management ─────────────────────────────────

export async function addTestersToGroup(
  groupId: string,
  testerIds: string[],
): Promise<void> {
  await ascFetch(`/v1/betaGroups/${groupId}/relationships/betaTesters`, {
    method: "POST",
    body: JSON.stringify({
      data: testerIds.map((id) => ({ type: "betaTesters", id })),
    }),
  });
  cacheInvalidatePrefix("tf-groups:");
}

export async function removeTestersFromGroup(
  groupId: string,
  testerIds: string[],
): Promise<void> {
  await ascFetch(`/v1/betaGroups/${groupId}/relationships/betaTesters`, {
    method: "DELETE",
    body: JSON.stringify({
      data: testerIds.map((id) => ({ type: "betaTesters", id })),
    }),
  });
  cacheInvalidatePrefix("tf-groups:");
}

/** Send TestFlight invitation emails. Without this testers stay NOT_INVITED. */
export async function sendBetaTesterInvitations(
  appId: string,
  testerIds: string[],
): Promise<void> {
  await Promise.allSettled(
    testerIds.map((id) =>
      ascFetch(`/v1/betaTesterInvitations`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "betaTesterInvitations",
            relationships: {
              betaTester: {
                data: { type: "betaTesters", id },
              },
              app: {
                data: { type: "apps", id: appId },
              },
            },
          },
        }),
      }),
    ),
  );
}
