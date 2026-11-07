import { beforeEach, describe, expect, it } from 'vitest'

import type { Repositories } from '~/infra/repositories'

const future = () => new Date(Date.now() + 3600_000)

/**
 * Behaviour every RefreshTokenRepository adapter must have. `makeRepos`
 * returns repositories over EMPTY stores (tokens belong to a user).
 */
export function describeRefreshTokenRepositoryContract(
  makeRepos: () => Promise<Repositories>
) {
  describe('RefreshTokenRepository contract', () => {
    let repos: Repositories
    let userId: string
    const family1 = '11111111-1111-4111-8111-111111111111'
    const family2 = '22222222-2222-4222-8222-222222222222'

    const create = (tokenHash: string, familyId = family1) =>
      repos.refreshTokens.create({
        userId,
        familyId,
        tokenHash,
        expiresAt: future(),
      })

    beforeEach(async () => {
      repos = await makeRepos()
      userId = (
        await repos.users.upsertByGoogleSub({
          googleSub: 's',
          email: 'a@x.com',
          name: 'A',
        })
      ).id
    })

    it('creates an active token and finds it by hash', async () => {
      const token = await create('hash-1')
      expect(token).toMatchObject({
        userId,
        familyId: family1,
        tokenHash: 'hash-1',
        revokedAt: null,
        replacedById: null,
      })
      expect(typeof token.id).toBe('string')
      expect(token.expiresAt).toBeInstanceOf(Date)
      expect(token.createdAt).toBeInstanceOf(Date)
      expect(await repos.refreshTokens.findByHash('hash-1')).toEqual(token)
    })

    it('findByHash returns null for an unknown hash', async () => {
      expect(await repos.refreshTokens.findByHash('nope')).toBeNull()
    })

    it('rejects a duplicate hash', async () => {
      await create('dup')
      await expect(create('dup')).rejects.toThrow()
    })

    it('markRotated revokes the old token once and links the new one', async () => {
      const old = await create('old')
      const next = await create('next')
      expect(await repos.refreshTokens.markRotated(old.id, next.id)).toBe(true)
      const stored = await repos.refreshTokens.findByHash('old')
      expect(stored?.revokedAt).toBeInstanceOf(Date)
      expect(stored?.replacedById).toBe(next.id)
      // a second rotation of the same token loses (race / reuse)
      expect(await repos.refreshTokens.markRotated(old.id, next.id)).toBe(false)
    })

    it('markRotated returns false for unknown or malformed ids', async () => {
      const next = await create('next')
      expect(await repos.refreshTokens.markRotated('nope', next.id)).toBe(false)
      expect(await repos.refreshTokens.markRotated(next.id, 'nope')).toBe(false)
    })

    it('revokeFamily revokes only active tokens of that family', async () => {
      const a = await create('a')
      const b = await create('b')
      await create('c', family2)
      await repos.refreshTokens.markRotated(a.id, b.id) // `a` already revoked
      expect(await repos.refreshTokens.revokeFamily(family1)).toBe(1)
      expect(
        (await repos.refreshTokens.findByHash('b'))?.revokedAt
      ).not.toBeNull()
      expect((await repos.refreshTokens.findByHash('c'))?.revokedAt).toBeNull()
      expect(await repos.refreshTokens.revokeFamily(family1)).toBe(0)
    })

    it('revokeFamily is a no-op for unknown or malformed families', async () => {
      expect(await repos.refreshTokens.revokeFamily('nope')).toBe(0)
      expect(
        await repos.refreshTokens.revokeFamily(
          '33333333-3333-4333-8333-333333333333'
        )
      ).toBe(0)
    })

    describe('deleteExpired', () => {
      const hour = 3600_000
      const past = (ms: number) => new Date(Date.now() - ms)
      const exists = async (hash: string) =>
        (await repos.refreshTokens.findByHash(hash)) !== null

      it('deletes expired tokens and keeps active ones', async () => {
        await repos.refreshTokens.create({
          userId,
          familyId: family1,
          tokenHash: 'expired',
          expiresAt: past(hour),
        })
        await create('active')
        expect(await repos.refreshTokens.deleteExpired(new Date())).toBe(1)
        expect(await exists('expired')).toBe(false)
        expect(await exists('active')).toBe(true)
      })

      it('keeps tokens that expired after the cutoff', async () => {
        await repos.refreshTokens.create({
          userId,
          familyId: family1,
          tokenHash: 'recent',
          expiresAt: past(1000),
        })
        expect(await repos.refreshTokens.deleteExpired(past(hour))).toBe(0)
        expect(await exists('recent')).toBe(true)
      })

      it('never deletes a revoked token that has not expired (reuse detection)', async () => {
        const old = await create('old')
        const next = await create('next')
        await repos.refreshTokens.markRotated(old.id, next.id)
        await repos.refreshTokens.revokeFamily(family1)
        expect(await repos.refreshTokens.deleteExpired(new Date())).toBe(0)
        expect(
          (await repos.refreshTokens.findByHash('old'))?.revokedAt
        ).not.toBeNull()
        expect(await exists('next')).toBe(true)
      })

      it('deletes a token that is both revoked and expired', async () => {
        const t = await repos.refreshTokens.create({
          userId,
          familyId: family1,
          tokenHash: 'both',
          expiresAt: past(hour),
        })
        await repos.refreshTokens.revokeFamily(family1)
        expect(t.revokedAt).toBeNull()
        expect(await repos.refreshTokens.deleteExpired(new Date())).toBe(1)
        expect(await exists('both')).toBe(false)
      })
    })
  })
}
