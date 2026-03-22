import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptedDek: string;
}

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const DEK_BYTES = 32;

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_MASTER_KEY must be a 64-char hex string");
  }
  return Buffer.from(hex, "hex");
}

function encryptWithKey(key: Buffer, plaintext: Buffer): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

function decryptWithKey(key: Buffer, ciphertext: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encrypt(plaintext: string): EncryptedPayload {
  const masterKey = getMasterKey();

  // Generate random DEK
  const dek = randomBytes(DEK_BYTES);

  // Encrypt plaintext with DEK
  const data = encryptWithKey(dek, Buffer.from(plaintext, "utf-8"));

  // Encrypt DEK with master key
  const wrappedDek = encryptWithKey(masterKey, dek);

  return {
    ciphertext: data.ciphertext.toString("base64"),
    iv: data.iv.toString("base64"),
    authTag: data.authTag.toString("base64"),
    encryptedDek: Buffer.concat([
      wrappedDek.iv,
      wrappedDek.authTag,
      wrappedDek.ciphertext,
    ]).toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const masterKey = getMasterKey();

  // Unwrap DEK
  const dekBundle = Buffer.from(payload.encryptedDek, "base64");
  const dekIv = dekBundle.subarray(0, IV_BYTES);
  const dekAuthTag = dekBundle.subarray(IV_BYTES, IV_BYTES + 16);
  const dekCiphertext = dekBundle.subarray(IV_BYTES + 16);
  const dek = decryptWithKey(masterKey, dekCiphertext, dekIv, dekAuthTag);

  // Decrypt data with DEK
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");

  return decryptWithKey(dek, ciphertext, iv, authTag).toString("utf-8");
}
