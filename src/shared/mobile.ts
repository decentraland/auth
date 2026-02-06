const MOBILE_SESSION_KEY = 'auth-mobile-session'
const MOBILE_SESSION_TTL = 10 * 60 * 1000 // 10 minutes

export interface MobileSession {
  t: number
  u?: string
  s?: string
}

export function isMobileSession(): boolean {
  const path = window.location.pathname

  // On /auth/mobile, persist session data and mark as mobile
  if (path.startsWith('/auth/mobile')) {
    const params = new URLSearchParams(window.location.search)
    const u = params.get('u')

    // If no user id in params, fall back to an existing recent session
    if (!u) {
      try {
        const raw = localStorage.getItem(MOBILE_SESSION_KEY)
        if (raw) {
          const prev: MobileSession = JSON.parse(raw)
          if (Date.now() - prev.t < MOBILE_SESSION_TTL) {
            return true
          }
          localStorage.removeItem(MOBILE_SESSION_KEY)
        }
      } catch {
        localStorage.removeItem(MOBILE_SESSION_KEY)
      }
      return true
    }

    const session: MobileSession = {
      t: Date.now(),
      u,
      s: params.get('s') ?? undefined
    }
    localStorage.setItem(MOBILE_SESSION_KEY, JSON.stringify(session))
    return true
  }

  // On other routes, check for a recent mobile session
  try {
    const raw = localStorage.getItem(MOBILE_SESSION_KEY)
    if (raw) {
      const session: MobileSession = JSON.parse(raw)
      if (Date.now() - session.t < MOBILE_SESSION_TTL) {
        return true
      }
      localStorage.removeItem(MOBILE_SESSION_KEY)
    }
  } catch {
    localStorage.removeItem(MOBILE_SESSION_KEY)
  }

  return false
}

export function getMobileSession(): MobileSession | null {
  try {
    const raw = localStorage.getItem(MOBILE_SESSION_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch {
    // ignore
  }
  return null
}
