import { cookies } from 'next/headers'

import {
  DIRECT_BLOGGER_COOKIE,
  loadDirectBloggerConfig,
  verifyDirectBloggerSession,
} from '@/lib/blogger/direct-access.mjs'

export async function getDirectBloggerSession() {
  try {
    const config = loadDirectBloggerConfig(process.env)
    const token = (await cookies()).get(DIRECT_BLOGGER_COOKIE)?.value
    if (!token) return null
    return verifyDirectBloggerSession(token, { secret: config.sessionSecret })
  } catch {
    return null
  }
}
