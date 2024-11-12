import { Cache } from '~/cache/cache'

interface Session {
  user_id: string
  refresh_token: string
}
export async function renewSession(userId: string, refreshToken: string) {
  const cache = new Cache()

  const session = await cache.get<Session>(`session:${123}`)

  if (!session) return
  const comparedToken = session.refresh_token === refreshToken
}
