import * as jose from 'jose'

const ASC_AUDIENCE = 'appstoreconnect-v1'
const TOKEN_VALIDITY_SECONDS = 20 * 60 // 20 minutes

/**
 * Create a JWT for App Store Connect API authentication.
 * Uses ES256 with the .p8 private key; header kid = keyId, payload iss = issuerId, aud = appstoreconnect-v1.
 */
export async function createAscJwt(
  issuerId: string,
  keyId: string,
  privateKeyPem: string,
): Promise<string> {
  const key = await jose.importPKCS8(privateKeyPem.trim(), 'ES256')
  const exp = Math.floor(Date.now() / 1000) + TOKEN_VALIDITY_SECONDS
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(issuerId)
    .setAudience(ASC_AUDIENCE)
    .setExpirationTime(exp)
    .sign(key)
}
