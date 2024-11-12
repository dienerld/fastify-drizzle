import { Cache } from '~/cache/cache'

export async function login() {
  const cache = new Cache()
  const userId = 123

  const session = {
    user_id: userId,
    refresh_token: '123',
    timestamp: Date.now(),
  }
  await cache.set(`session:${userId}`, JSON.stringify(session))
  return session
}
