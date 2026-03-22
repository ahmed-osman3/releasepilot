import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt, type EncryptedPayload } from "@/lib/encryption";

const TEST_MASTER_KEY = "9fce91a7ca8c37d1f9e0280d897274519bfc81d9ef8876707bc2ff0727680462";

describe("encryption", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_MASTER_KEY;
    process.env.ENCRYPTION_MASTER_KEY = TEST_MASTER_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.ENCRYPTION_MASTER_KEY = originalKey;
    } else {
      delete process.env.ENCRYPTION_MASTER_KEY;
    }
  });

  it("round-trips plaintext", () => {
    const plaintext = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----";
    const payload = encrypt(plaintext);
    expect(decrypt(payload)).toBe(plaintext);
  });

  it("round-trips empty string", () => {
    const payload = encrypt("");
    expect(decrypt(payload)).toBe("");
  });

  it("round-trips unicode content", () => {
    const plaintext = "sk-ant-api03-こんにちは-🔑";
    const payload = encrypt(plaintext);
    expect(decrypt(payload)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext", () => {
    const plaintext = "same-secret";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.encryptedDek).not.toBe(b.encryptedDek);
  });

  it("produces base64-encoded fields", () => {
    const payload = encrypt("test");
    const base64 = /^[A-Za-z0-9+/]+=*$/;
    expect(payload.ciphertext).toMatch(base64);
    expect(payload.iv).toMatch(base64);
    expect(payload.authTag).toMatch(base64);
    expect(payload.encryptedDek).toMatch(base64);
  });

  it("throws on tampered ciphertext", () => {
    const payload = encrypt("secret");
    const tampered: EncryptedPayload = {
      ...payload,
      ciphertext: Buffer.from("tampered").toString("base64"),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on tampered authTag", () => {
    const payload = encrypt("secret");
    const tampered: EncryptedPayload = {
      ...payload,
      authTag: Buffer.from(randomBytes(16)).toString("base64"),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on tampered IV", () => {
    const payload = encrypt("secret");
    const tampered: EncryptedPayload = {
      ...payload,
      iv: Buffer.from(randomBytes(12)).toString("base64"),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on tampered encryptedDek", () => {
    const payload = encrypt("secret");
    const tampered: EncryptedPayload = {
      ...payload,
      encryptedDek: Buffer.from(randomBytes(60)).toString("base64"),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws with wrong master key", () => {
    const payload = encrypt("secret");
    process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString("hex");
    expect(() => decrypt(payload)).toThrow();
  });

  it("throws without master key", () => {
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(() => encrypt("secret")).toThrow("ENCRYPTION_MASTER_KEY");
  });

  it("throws with invalid master key length", () => {
    process.env.ENCRYPTION_MASTER_KEY = "tooshort";
    expect(() => encrypt("secret")).toThrow("ENCRYPTION_MASTER_KEY");
  });
});
