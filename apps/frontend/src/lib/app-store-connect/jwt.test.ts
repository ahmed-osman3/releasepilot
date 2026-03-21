import { describe, expect, it } from 'vitest'
import { createAscJwt } from './jwt'

// EC P-256 private key in PKCS#8 (.p8) format for testing only
const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgiyvo0X+VQ0yIrOaN
nlrnUclopnvuuMfoc8HHly3505OhRANCAAQWUcdZ8uTSAsFuwtNy4KtsKqgeqYxg
l6kwL5D4N3pEGYGIDjV69Sw0zAt43480WqJv7HCL0mQnyqFmSrxj8jMa
-----END PRIVATE KEY-----`

describe('createAscJwt', () => {
  const issuerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  const keyId = 'TESTKEYID01'

  it('returns a JWT string with correct iss and kid in header and exp ~20 min from now', async () => {
    const before = Math.floor(Date.now() / 1000)
    const token = await createAscJwt(issuerId, keyId, testPrivateKey)
    const after = Math.floor(Date.now() / 1000)

    expect(token).toBeTypeOf('string')
    expect(token.split('.')).toHaveLength(3)

    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as { iss: string; exp: number; aud: string }
    expect(payload.iss).toBe(issuerId)
    expect(payload.aud).toBe('appstoreconnect-v1')
    const twentyMin = 20 * 60
    expect(payload.exp).toBeGreaterThanOrEqual(before + twentyMin - 60)
    expect(payload.exp).toBeLessThanOrEqual(after + twentyMin + 60)

    const [headerB64] = token.split('.')
    const header = JSON.parse(
      Buffer.from(headerB64, 'base64url').toString('utf8'),
    ) as { alg: string; kid: string }
    expect(header.alg).toBe('ES256')
    expect(header.kid).toBe(keyId)
  })
})
