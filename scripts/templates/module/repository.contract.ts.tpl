import { beforeEach, describe, expect, it } from 'vitest'

import type { Repositories } from '~/infra/repositories'
import type { {{Name}}Repository } from './repository'

const OTHER_ID_FORMATS = [
  '507f1f77bcf86cd799439011',
  '00000000-0000-4000-8000-000000000000',
  'not-an-id',
]

/**
 * Behaviour every {{Name}}Repository adapter must have. Run by
 * `repository.postgres.test.ts` and `repository.mongo.test.ts` against real DBs.
 * `makeRepos` returns repositories over EMPTY stores ({{pluralWords}} belong to users).
 */
export function describe{{Name}}RepositoryContract(
  makeRepos: () => Promise<Repositories>
) {
  describe('{{Name}}Repository contract', () => {
    let repo: {{Name}}Repository
    let userId: string
    let otherUserId: string

    beforeEach(async () => {
      const repos = await makeRepos()
      repo = repos.{{pluralCamel}}
      const mk = (googleSub: string) =>
        repos.users.upsertByGoogleSub({
          googleSub,
          email: `${googleSub}@x.com`,
          name: googleSub,
        })
      userId = (await mk('a')).id
      otherUserId = (await mk('b')).id
    })

    it('creates with defaults and the owner', async () => {
      const {{camel}} = await repo.create(userId, { name: 'write tests' })
      expect({{camel}}).toMatchObject({
        userId,
        name: 'write tests',
        description: null,
      })
      expect(typeof {{camel}}.id).toBe('string')
      expect({{camel}}.createdAt).toBeInstanceOf(Date)
      expect({{camel}}.updatedAt).toBeInstanceOf(Date)
    })

    it('gets by id and returns null for unknown or malformed ids', async () => {
      const {{camel}} = await repo.create(userId, { name: 'a', description: 'd' })
      expect(await repo.get(userId, {{camel}}.id)).toEqual({{camel}})
      for (const id of OTHER_ID_FORMATS) {
        expect(await repo.get(userId, id)).toBeNull()
      }
    })

    it('lists newest first', async () => {
      expect(await repo.list(userId)).toEqual([])
      const first = await repo.create(userId, { name: 'first' })
      await new Promise(r => setTimeout(r, 5))
      const second = await repo.create(userId, { name: 'second' })
      expect((await repo.list(userId)).map(t => t.id)).toEqual([
        second.id,
        first.id,
      ])
    })

    it('updates only the given fields and bumps updatedAt', async () => {
      const {{camel}} = await repo.create(userId, {
        name: 'a',
        description: 'keep',
      })
      await new Promise(r => setTimeout(r, 5))
      const updated = await repo.update(userId, {{camel}}.id, { name: 'b' })
      expect(updated).toMatchObject({
        id: {{camel}}.id,
        name: 'b',
        description: 'keep',
      })
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        {{camel}}.updatedAt.getTime()
      )
      expect(updated?.createdAt).toEqual({{camel}}.createdAt)
    })

    it('clears description with null', async () => {
      const {{camel}} = await repo.create(userId, { name: 'a', description: 'x' })
      const updated = await repo.update(userId, {{camel}}.id, { description: null })
      expect(updated?.description).toBeNull()
    })

    it('update returns null for unknown or malformed ids', async () => {
      expect(
        await repo.update(userId, '507f1f77bcf86cd799439011', {})
      ).toBeNull()
      expect(await repo.update(userId, 'nope', { name: 'x' })).toBeNull()
    })

    it('deletes and reports whether something was deleted', async () => {
      const {{camel}} = await repo.create(userId, { name: 'a' })
      expect(await repo.delete(userId, {{camel}}.id)).toBe(true)
      expect(await repo.delete(userId, {{camel}}.id)).toBe(false)
      expect(await repo.delete(userId, 'nope')).toBe(false)
      expect(await repo.get(userId, {{camel}}.id)).toBeNull()
    })

    describe('scoped by user', () => {
      it('list only returns the owner {{pluralWords}}', async () => {
        await repo.create(userId, { name: 'mine' })
        await repo.create(otherUserId, { name: 'theirs' })
        expect((await repo.list(userId)).map(t => t.name)).toEqual(['mine'])
        expect((await repo.list(otherUserId)).map(t => t.name)).toEqual([
          'theirs',
        ])
      })

      it("get/update/delete cannot reach another user's {{camel}}", async () => {
        const theirs = await repo.create(otherUserId, { name: 'theirs' })
        expect(await repo.get(userId, theirs.id)).toBeNull()
        expect(
          await repo.update(userId, theirs.id, { name: 'hacked' })
        ).toBeNull()
        expect(await repo.delete(userId, theirs.id)).toBe(false)
        // untouched
        expect(await repo.get(otherUserId, theirs.id)).toEqual(theirs)
      })

      it('malformed or unknown user ids see nothing', async () => {
        const {{camel}} = await repo.create(userId, { name: 'a' })
        for (const id of OTHER_ID_FORMATS) {
          expect(await repo.list(id)).toEqual([])
          expect(await repo.get(id, {{camel}}.id)).toBeNull()
          expect(await repo.delete(id, {{camel}}.id)).toBe(false)
        }
      })
    })
  })
}
