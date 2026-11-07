import { beforeEach, describe, expect, it } from 'vitest'

import type { GoogleProfile, UserRepository } from './repository'

const profile: GoogleProfile = {
  googleSub: 'google-sub-1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
}

/**
 * Behaviour every UserRepository adapter must have. `makeRepo` returns a
 * repository over an EMPTY users store.
 */
export function describeUserRepositoryContract(
  makeRepo: () => Promise<UserRepository>
) {
  describe('UserRepository contract', () => {
    let repo: UserRepository

    beforeEach(async () => {
      repo = await makeRepo()
    })

    it('upsert creates a user with null picture by default', async () => {
      const user = await repo.upsertByGoogleSub(profile)
      expect(user).toMatchObject({ ...profile, picture: null })
      expect(typeof user.id).toBe('string')
      expect(user.createdAt).toBeInstanceOf(Date)
    })

    it('upsert stores the picture when given', async () => {
      const user = await repo.upsertByGoogleSub({
        ...profile,
        picture: 'http://p/1.png',
      })
      expect(user.picture).toBe('http://p/1.png')
    })

    it('upsert on the same googleSub updates the profile and keeps the id', async () => {
      const first = await repo.upsertByGoogleSub(profile)
      const second = await repo.upsertByGoogleSub({
        ...profile,
        email: 'new@example.com',
        name: 'Ada B.',
        picture: 'http://p/2.png',
      })
      expect(second.id).toBe(first.id)
      expect(second.createdAt).toEqual(first.createdAt)
      expect(second).toMatchObject({
        email: 'new@example.com',
        name: 'Ada B.',
        picture: 'http://p/2.png',
      })
    })

    it('concurrent upserts of the same googleSub create a single user', async () => {
      const users = await Promise.all(
        Array.from({ length: 5 }, () => repo.upsertByGoogleSub(profile))
      )
      expect(new Set(users.map(u => u.id)).size).toBe(1)
    })

    it('different googleSubs are different users', async () => {
      const a = await repo.upsertByGoogleSub(profile)
      const b = await repo.upsertByGoogleSub({ ...profile, googleSub: 'other' })
      expect(a.id).not.toBe(b.id)
    })

    it('finds by id', async () => {
      const user = await repo.upsertByGoogleSub(profile)
      expect(await repo.findById(user.id)).toEqual(user)
    })

    it('returns null for unknown or malformed ids', async () => {
      expect(await repo.findById('507f1f77bcf86cd799439011')).toBeNull()
      expect(
        await repo.findById('00000000-0000-4000-8000-000000000000')
      ).toBeNull()
      expect(await repo.findById('not-an-id')).toBeNull()
    })
  })
}
