import assert from 'node:assert/strict'
import test from 'node:test'

const direct = await import('../src/lib/blogger/direct-access.mjs').catch(() => ({}))

const password = 'Sport-Blogger-Only-2026!'
const secret = 'session_4Yz!Q9mP2vK7xN5cR8tL3wD6hF1sJ0aB'

test('owner-managed Blogger credentials use a strong one-way password hash', async () => {
  assert.equal(typeof direct.generateDirectBloggerPasswordHash, 'function')
  const encoded = await direct.generateDirectBloggerPasswordHash(password, { salt: Buffer.alloc(16, 7) })
  assert.match(encoded, /^scrypt\$v1\$/)
  assert.equal(encoded.includes(password), false)
  assert.equal(await direct.verifyDirectBloggerPassword(password, encoded), true)
  assert.equal(await direct.verifyDirectBloggerPassword('wrong-password', encoded), false)
})

test('direct Blogger session is signed, site-bound, expiring and invalidated by secret rotation', () => {
  assert.equal(typeof direct.createDirectBloggerSession, 'function')
  const now = 1_800_000_000_000
  const token = direct.createDirectBloggerSession({ secret, now, ttlMs: 8 * 60 * 60 * 1000 })
  assert.deepEqual(direct.verifyDirectBloggerSession(token, { secret, now: now + 1_000 }), {
    siteKey: 'sportmassagefuengirola',
    expiresAt: now + 8 * 60 * 60 * 1000,
  })
  assert.equal(direct.verifyDirectBloggerSession(`${token}x`, { secret, now }), null)
  assert.equal(direct.verifyDirectBloggerSession(token, { secret: `${secret}rotated!`, now }), null)
  assert.equal(direct.verifyDirectBloggerSession(token, { secret, now: now + 8 * 60 * 60 * 1000 }), null)
})

test('direct credential configuration is fixed to Sport Massage and fails closed', () => {
  assert.equal(typeof direct.loadDirectBloggerConfig, 'function')
  const passwordHash = 'scrypt$v1$BwcHBwcHBwcHBwcHBwcHBw$47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU'
  const config = direct.loadDirectBloggerConfig({
    SPORT_BLOGGER_DIRECT_USERNAME: 'sportmassagefuengirola@gmail.com',
    SPORT_BLOGGER_DIRECT_PASSWORD_HASH: passwordHash,
    SPORT_BLOGGER_DIRECT_SESSION_SECRET: secret,
  })
  assert.equal(config.username, 'sportmassagefuengirola@gmail.com')
  assert.equal(config.siteKey, 'sportmassagefuengirola')
  assert.throws(() => direct.loadDirectBloggerConfig({}), /unavailable/i)
  assert.throws(() => direct.loadDirectBloggerConfig({
    SPORT_BLOGGER_DIRECT_USERNAME: 'other@example.com',
    SPORT_BLOGGER_DIRECT_PASSWORD_HASH: passwordHash,
    SPORT_BLOGGER_DIRECT_SESSION_SECRET: secret,
  }), /unavailable/i)
})
