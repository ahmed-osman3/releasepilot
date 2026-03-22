import { db } from "@/db";
import { licenseActivations } from "@/db/schema";
import { encrypt, decrypt } from "@/lib/encryption";
import { ulid } from "@/lib/ulid";

export { FREE_LIMITS, CHECKOUT_URL, maskKey } from "@/lib/license-shared";

export interface LicenseInfo {
  key: string;
  email: string;
  instanceId: string;
  activatedAt: string;
}

let _proCache: boolean | null = null;

/** Reset the in-memory Pro cache (e.g. after activation/deactivation). */
export function resetProCache(): void {
  _proCache = null;
}

/** Check if a valid Pro license activation exists. */
export function isPro(): boolean {
  if (_proCache !== null) return _proCache;
  const row = db
    .select({ id: licenseActivations.id })
    .from(licenseActivations)
    .get();
  _proCache = !!row;
  return _proCache;
}

/** Read the license activation from DB and decrypt the key. */
export function getLicense(): LicenseInfo | null {
  const row = db
    .select({
      encryptedLicenseKey: licenseActivations.encryptedLicenseKey,
      iv: licenseActivations.iv,
      authTag: licenseActivations.authTag,
      encryptedDek: licenseActivations.encryptedDek,
      instanceId: licenseActivations.instanceId,
      email: licenseActivations.email,
      activatedAt: licenseActivations.activatedAt,
    })
    .from(licenseActivations)
    .get();

  if (!row) return null;

  const key = decrypt({
    ciphertext: row.encryptedLicenseKey,
    iv: row.iv,
    authTag: row.authTag,
    encryptedDek: row.encryptedDek,
  });

  return {
    key,
    email: row.email,
    instanceId: row.instanceId,
    activatedAt: row.activatedAt,
  };
}

/** Store a new license activation (replaces any existing). */
export function setLicense(data: {
  licenseKey: string;
  instanceId: string;
  email: string;
}): void {
  // Remove any existing activation
  db.delete(licenseActivations).run();

  const encrypted = encrypt(data.licenseKey);
  db.insert(licenseActivations)
    .values({
      id: ulid(),
      encryptedLicenseKey: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      encryptedDek: encrypted.encryptedDek,
      instanceId: data.instanceId,
      email: data.email,
    })
    .run();

  resetProCache();
}

/** Remove the license activation. */
export function clearLicense(): void {
  db.delete(licenseActivations).run();
  resetProCache();
}
