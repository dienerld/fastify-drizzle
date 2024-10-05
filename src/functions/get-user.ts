import { eq } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";

export async function getUser(externalId: string) {
  const userDb = await db.select({
    id: user.id,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    externalId: user.externalId,
    picture: user.picture,
    createdAt: user.createdAt,
  })
    .from(user)
    .where(eq(user.externalId, externalId))
    .execute()

  return { user: userDb[0] }
}
