import { useAfterLoginRedirection } from './redirection'
import { useSkipSetup } from './useSkipSetup'

/**
 * Combines after-login redirection with the skip-setup flag.
 *
 * The Explorer deeplink is NOT handled here — it's triggered by RequestPage
 * after the signing flow completes ("Login Successful" view), since that's
 * the only place where the Explorer needs to be re-focused.
 */
export const usePostLoginRedirect = () => {
  const { redirect, url: redirectTo } = useAfterLoginRedirection()
  const skipSetup = useSkipSetup()

  return { redirect, redirectTo, skipSetup }
}
