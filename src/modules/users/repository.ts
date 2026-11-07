export type User = {
  id: string
  email: string
  name: string
  /** Google account id (`sub` claim): the stable identity of the user. */
  googleSub: string
  picture: string | null
  createdAt: Date
}

export type GoogleProfile = {
  googleSub: string
  email: string
  name: string
  picture?: string | null
}

export interface UserRepository {
  /** Returns `null` when the id is unknown or malformed. */
  findById(id: string): Promise<User | null>
  /**
   * Creates the user, or refreshes email/name/picture of the existing one with
   * the same `googleSub`. Atomic: concurrent calls never create duplicates.
   */
  upsertByGoogleSub(profile: GoogleProfile): Promise<User>
}
