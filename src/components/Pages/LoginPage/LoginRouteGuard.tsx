// eslint-disable-next-line @typescript-eslint/naming-convention
import React, { Suspense } from 'react'
import { CircularProgress } from 'decentraland-ui2'
import { ConnectionOptionType } from '../../Connection/Connection.types'
import { SocialAutoLoginRedirect } from './SocialAutoLoginRedirect'

const LazyLoginPage = React.lazy(() => import('./LoginPage').then(m => ({ default: m.LoginPage })))

const SOCIAL_LOGIN_METHODS: Record<string, ConnectionOptionType> = {
  google: ConnectionOptionType.GOOGLE,
  discord: ConnectionOptionType.DISCORD,
  apple: ConnectionOptionType.APPLE,
  x: ConnectionOptionType.X
}

function getSocialAutoLoginType(): ConnectionOptionType | null {
  const param = new URLSearchParams(window.location.search).get('loginMethod')?.toLowerCase()
  if (!param) return null
  return SOCIAL_LOGIN_METHODS[param] ?? null
}

export const LoginRouteGuard = () => {
  const socialAutoLoginType = getSocialAutoLoginType()

  if (socialAutoLoginType) {
    return <SocialAutoLoginRedirect connectionType={socialAutoLoginType} />
  }

  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress size={80} />
        </div>
      }
    >
      <LazyLoginPage />
    </Suspense>
  )
}
