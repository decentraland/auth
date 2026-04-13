// eslint-disable-next-line @typescript-eslint/naming-convention
import React, { Suspense } from 'react'
import { CircularProgress } from 'decentraland-ui2'
import { ConnectionOptionType } from '../../Connection/Connection.types'
import { AutoLoginRedirect } from './AutoLoginRedirect'

const LazyLoginPage = React.lazy(() => import('./LoginPage').then(m => ({ default: m.LoginPage })))

/** Login methods that support auto-redirect without showing the full LoginPage */
const AUTO_LOGIN_METHODS: Record<string, ConnectionOptionType> = {
  google: ConnectionOptionType.GOOGLE,
  discord: ConnectionOptionType.DISCORD,
  apple: ConnectionOptionType.APPLE,
  x: ConnectionOptionType.X,
  metamask: ConnectionOptionType.METAMASK
}

function getAutoLoginType(): ConnectionOptionType | null {
  const param = new URLSearchParams(window.location.search).get('loginMethod')?.toLowerCase()
  if (!param) return null
  return AUTO_LOGIN_METHODS[param] ?? null
}

export const LoginRouteGuard = () => {
  const autoLoginType = getAutoLoginType()

  if (autoLoginType) {
    return <AutoLoginRedirect connectionType={autoLoginType} />
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
