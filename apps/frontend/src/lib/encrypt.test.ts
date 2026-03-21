import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decrypt, encrypt } from './encrypt'

describe('encrypt', () => {
  const plaintext = 'secret-api-key-content'

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-32-byte-secret-for-testing-only!!'
  })
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('encrypt(plaintext) returns a string', () => {
    const cipher = encrypt(plaintext)
    expect(cipher).toBeTypeOf('string')
    expect(cipher.length).toBeGreaterThan(0)
    expect(cipher).not.toBe(plaintext)
  })

  it('decrypt(encrypt(plaintext)) === plaintext', () => {
    const cipher = encrypt(plaintext)
    const decrypted = decrypt(cipher)
    expect(decrypted).toBe(plaintext)
  })

  it('decrypt of tampered ciphertext returns null or throws', () => {
    const cipher = encrypt(plaintext)
    const tampered = cipher.slice(0, -2) + 'xx'
    const result = decrypt(tampered)
    expect(result === null || result !== plaintext).toBe(true)
  })
})
