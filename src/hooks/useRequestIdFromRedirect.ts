import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Extracts the request ID from the redirectTo URL search parameter.
 * Matches paths like /auth/requests/0377e459-8fdf-4ce5-89f4-4f1f1c7bbb7f
 */
export const useRequestIdFromRedirect = (): string | null => {
  const [urlSearchParams] = useSearchParams()

  return useMemo(() => {
    const redirectTo = urlSearchParams.get('redirectTo')
    try {
      const url = new URL(redirectTo ?? '', window.location.origin)
      const regex = /^\/?auth\/requests\/([a-zA-Z0-9-]+)$/
      return url.pathname.match(regex)?.[1] ?? null
    } catch {
      return null
    }
  }, [urlSearchParams])
}
