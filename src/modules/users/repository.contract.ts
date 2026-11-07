import { beforeEach, describe, expect, it } from 'vitest'

import type { NewUser, UserRepository } from './repository'

const input: NewUser = {
  fullName: 'Ada Lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  externalId: 'ext-1',
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

    it('creates a user with null picture by default', async () => {
      const user = await repo.create(input)
      expect(user).toMatchObject({ ...input, picture: null })
      expect(typeof user.id).toBe('string')
      expect(user.createdAt).toBeInstanceOf(Date)
    })

    it('stores the picture when given', async () => {
      const user = await repo.create({ ...input, picture: 'http://p/1.png' })
      expect(user.picture).toBe('http://p/1.png')
    })

    it('finds by id and by external id', async () => {
      const user = await repo.create(input)
      expect(await repo.findById(user.id)).toEqual(user)
      expect(await repo.findByExternalId('ext-1')).toEqual(user)
    })

    it('returns null for unknown or malformed ids and external ids', async () => {
      expect(await repo.findById('507f1f77bcf86cd799439011')).toBeNull()
      expect(
        await repo.findById('00000000-0000-4000-8000-000000000000')
      ).toBeNull()
      expect(await repo.findById('not-an-id')).toBeNull()
      expect(await repo.findByExternalId('missing')).toBeNull()
    })

    it('rejects a duplicate external id', async () => {
      await repo.create(input)
      await expect(
        repo.create({ ...input, email: 'b@x.com' })
      ).rejects.toThrow()
    })
  })
}
