import { createPrivateKey, sign } from "node:crypto";

const ASC_AUDIENCE = "appstoreconnect-v1";
const TOKEN_LIFETIME_SEC = 15 * 60; // 15 minutes

function base64url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

export function generateAscJwt(
  issuerId: string,
  keyId: string,
  privateKeyPem: string,
): string {
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(
    JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }),
  );

  const payload = base64url(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + TOKEN_LIFETIME_SEC,
      aud: ASC_AUDIENCE,
    }),
  );

  const signingInput = `${header}.${payload}`;

  const key = createPrivateKey({
    key: privateKeyPem,
    format: "pem",
    type: "pkcs8",
  });

  const signature = sign("SHA256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });

  return `${signingInput}.${base64url(signature)}`;
}
