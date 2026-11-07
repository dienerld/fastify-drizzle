import { beforeEach, describe, expect, it } from 'vitest'

import type { Repositories } from '~/infra/repositories'
import type { TodoRepository } from './repository'

const OTHER_ID_FORMATS = [
  '507f1f77bcf86cd799439011',
  '00000000-0000-4000-8000-000000000000',
  'not-an-id',
]

/**
 * Behaviour every TodoRepository adapter must have. Run by
 * `repository.postgres.test.ts` and `repository.mongo.test.ts` against real DBs.
 * `makeRepos` returns repositories over EMPTY stores (todos belong to users).
 */
export function describeTodoRepositoryContract(
  makeRepos: () => Promise<Repositories>
) {
  describe('TodoRepository contract', () => {
    let repo: TodoRepository
    let userId: string
    let otherUserId: string

    beforeEach(async () => {
      const repos = await makeRepos()
      repo = repos.todos
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
      const todo = await repo.create(userId, { title: 'write tests' })
      expect(todo).toMatchObject({
        userId,
        title: 'write tests',
        description: null,
        completed: false,
      })
      expect(typeof todo.id).toBe('string')
      expect(todo.createdAt).toBeInstanceOf(Date)
      expect(todo.updatedAt).toBeInstanceOf(Date)
    })

    it('gets by id and returns null for unknown or malformed ids', async () => {
      const todo = await repo.create(userId, { title: 'a', description: 'd' })
      expect(await repo.get(userId, todo.id)).toEqual(todo)
      for (const id of OTHER_ID_FORMATS) {
        expect(await repo.get(userId, id)).toBeNull()
      }
    })

    it('lists newest first', async () => {
      expect(await repo.list(userId)).toEqual([])
      const first = await repo.create(userId, { title: 'first' })
      await new Promise(r => setTimeout(r, 5))
      const second = await repo.create(userId, { title: 'second' })
      expect((await repo.list(userId)).map(t => t.id)).toEqual([
        second.id,
        first.id,
      ])
    })

    it('updates only the given fields and bumps updatedAt', async () => {
      const todo = await repo.create(userId, {
        title: 'a',
        description: 'keep',
      })
      await new Promise(r => setTimeout(r, 5))
      const updated = await repo.update(userId, todo.id, { completed: true })
      expect(updated).toMatchObject({
        id: todo.id,
        title: 'a',
        description: 'keep',
        completed: true,
      })
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        todo.updatedAt.getTime()
      )
      expect(updated?.createdAt).toEqual(todo.createdAt)
    })

    it('clears description with null', async () => {
      const todo = await repo.create(userId, { title: 'a', description: 'x' })
      const updated = await repo.update(userId, todo.id, { description: null })
      expect(updated?.description).toBeNull()
    })

    it('update returns null for unknown or malformed ids', async () => {
      expect(
        await repo.update(userId, '507f1f77bcf86cd799439011', {})
      ).toBeNull()
      expect(await repo.update(userId, 'nope', { title: 'x' })).toBeNull()
    })

    it('deletes and reports whether something was deleted', async () => {
      const todo = await repo.create(userId, { title: 'a' })
      expect(await repo.delete(userId, todo.id)).toBe(true)
      expect(await repo.delete(userId, todo.id)).toBe(false)
      expect(await repo.delete(userId, 'nope')).toBe(false)
      expect(await repo.get(userId, todo.id)).toBeNull()
    })

    describe('scoped by user', () => {
      it('list only returns the owner todos', async () => {
        await repo.create(userId, { title: 'mine' })
        await repo.create(otherUserId, { title: 'theirs' })
        expect((await repo.list(userId)).map(t => t.title)).toEqual(['mine'])
        expect((await repo.list(otherUserId)).map(t => t.title)).toEqual([
          'theirs',
        ])
      })

      it("get/update/delete cannot reach another user's todo", async () => {
        const theirs = await repo.create(otherUserId, { title: 'theirs' })
        expect(await repo.get(userId, theirs.id)).toBeNull()
        expect(
          await repo.update(userId, theirs.id, { title: 'hacked' })
        ).toBeNull()
        expect(await repo.delete(userId, theirs.id)).toBe(false)
        // untouched
        expect(await repo.get(otherUserId, theirs.id)).toEqual(theirs)
      })

      it('malformed or unknown user ids see nothing', async () => {
        const todo = await repo.create(userId, { title: 'a' })
        for (const id of OTHER_ID_FORMATS) {
          expect(await repo.list(id)).toEqual([])
          expect(await repo.get(id, todo.id)).toBeNull()
          expect(await repo.delete(id, todo.id)).toBe(false)
        }
      })
    })
  })
}
