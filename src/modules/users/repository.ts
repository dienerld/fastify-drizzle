export type User = {
  id: string
  fullName: string
  firstName: string
  lastName: string
  email: string
  externalId: string
  picture: string | null
  createdAt: Date
}

export type NewUser = Omit<User, 'id' | 'createdAt' | 'picture'> & {
  picture?: string | null
}

export interface UserRepository {
  /** Returns `null` when the id is unknown or malformed. */
  findById(id: string): Promise<User | null>
  findByExternalId(externalId: string): Promise<User | null>
  /** Rejects with a unique violation when `externalId` already exists. */
  create(input: NewUser): Promise<User>
}
