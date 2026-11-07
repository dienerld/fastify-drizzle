import { beforeEach, describe, expect, it } from 'vitest'

import type { TodoRepository } from './repository'

/**
 * Behaviour every TodoRepository adapter must have. Run by
 * `repository.postgres.test.ts` and `repository.mongo.test.ts` against real DBs.
 * `makeRepo` returns a repository over an EMPTY todos store.
 */
export function describeTodoRepositoryContract(
  makeRepo: () => Promise<TodoRepository>
) {
  describe('TodoRepository contract', () => {
    let repo: TodoRepository

    beforeEach(async () => {
      repo = await makeRepo()
    })

    it('creates with defaults', async () => {
      const todo = await repo.create({ title: 'write tests' })
      expect(todo).toMatchObject({
        title: 'write tests',
        description: null,
        completed: false,
      })
      expect(typeof todo.id).toBe('string')
      expect(todo.createdAt).toBeInstanceOf(Date)
      expect(todo.updatedAt).toBeInstanceOf(Date)
    })

    it('gets by id and returns null for unknown or malformed ids', async () => {
      const todo = await repo.create({ title: 'a', description: 'd' })
      expect(await repo.get(todo.id)).toEqual(todo)
      expect(await repo.get('507f1f77bcf86cd799439011')).toBeNull()
      expect(await repo.get('00000000-0000-4000-8000-000000000000')).toBeNull()
      expect(await repo.get('not-an-id')).toBeNull()
    })

    it('lists newest first', async () => {
      expect(await repo.list()).toEqual([])
      const first = await repo.create({ title: 'first' })
      await new Promise(r => setTimeout(r, 5))
      const second = await repo.create({ title: 'second' })
      expect((await repo.list()).map(t => t.id)).toEqual([second.id, first.id])
    })

    it('updates only the given fields and bumps updatedAt', async () => {
      const todo = await repo.create({ title: 'a', description: 'keep' })
      await new Promise(r => setTimeout(r, 5))
      const updated = await repo.update(todo.id, { completed: true })
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
      const todo = await repo.create({ title: 'a', description: 'x' })
      const updated = await repo.update(todo.id, { description: null })
      expect(updated?.description).toBeNull()
    })

    it('update returns null for unknown or malformed ids', async () => {
      expect(await repo.update('507f1f77bcf86cd799439011', {})).toBeNull()
      expect(await repo.update('nope', { title: 'x' })).toBeNull()
    })

    it('deletes and reports whether something was deleted', async () => {
      const todo = await repo.create({ title: 'a' })
      expect(await repo.delete(todo.id)).toBe(true)
      expect(await repo.delete(todo.id)).toBe(false)
      expect(await repo.delete('nope')).toBe(false)
      expect(await repo.get(todo.id)).toBeNull()
    })
  })
}
