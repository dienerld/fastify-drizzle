import { eq } from 'drizzle-orm'
import { db } from '../db'
import { user } from '../db/schema'

interface CreateUserRequest {
  fullName: string
  firstName: string
  lastName: string
  email: string
  externalId: string
  picture?: string
}

export async function createUser({
  fullName,
  firstName,
  lastName,
  email,
  externalId,
  picture,
}: CreateUserRequest) {
  const [userDb] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.externalId, externalId))
    .limit(1)
    .execute()

  if (userDb) {
    return {
      newUser: false,
    }
  }

  await db
    .insert(user)
    .values({
      fullName,
      firstName,
      lastName,
      email,
      externalId,
      picture,
    })
    .execute()

  return {
    newUser: true,
  }
}
