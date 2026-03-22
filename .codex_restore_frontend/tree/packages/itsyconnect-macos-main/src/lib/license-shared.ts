/** License constants shared between server and client. */

export const IS_MAS = process.env.NEXT_PUBLIC_MAS === "1";

export const FREE_LIMITS = { apps: 1, teams: 1 } as const;

export const CHECKOUT_URL = "https://store.itsyapps.com/checkout/buy/24eefb3e-182a-4766-981e-cfe0f6753291";

/** Mask a license key to show only the first 8 characters. */
export function maskKey(key: string): string {
  if (key.length <= 8) return key;
  return key.slice(0, 8) + "...";
}
