import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { config } from '../../modules/config'
import { THIRTY_SECONDS } from '../../shared/time'
import { FeatureFlagsContext, defaultFeatureFlagsContextValue } from './FeatureFlagsProvider.types'

export const FeatureFlagsProvider = (props: PropsWithChildren<unknown>) => {
  const [value, setValue] = useState(defaultFeatureFlagsContextValue)
  const [shouldFetch, setShouldFetch] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    ;(async () => {
      if (shouldFetch) {
        setShouldFetch(false)
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        try {
          const baseUrl = config.get('FEATURE_FLAGS_URL')
          const controller = new AbortController()
          timeoutId = setTimeout(() => controller.abort(), THIRTY_SECONDS)

          const fetchJson = async (path: string) => {
            const response = await fetch(`${baseUrl}/${path}`, { signal: controller.signal })
            return response.json()
          }

          const [dappsJson, explorerJson] = await Promise.all([fetchJson('dapps.json'), fetchJson('explorer.json')])

          const mergedFlags = {
            ...(dappsJson?.flags ?? {}),
            ...(explorerJson?.flags ?? {})
          }
          const mergedVariants = {
            ...(dappsJson?.variants ?? {}),
            ...(explorerJson?.variants ?? {})
          }

          setValue(prev => ({ ...prev, flags: mergedFlags, variants: mergedVariants, initialized: true }))
        } catch (error) {
          // Don't blow away previously-loaded flags on a transient refresh
          // failure. The polling loop runs every FEATURE_FLAGS_INTERVAL, and a
          // single network blip used to wipe `flags`/`variants` to `{}`, which
          // can flip downstream guards like `useSkipSetup` and route the user
          // to /quick-setup mid-flow. We only fall back to empty if we never
          // loaded successfully (first mount).
          setValue(prev => ({
            flags: prev.initialized ? prev.flags : {},
            variants: prev.initialized ? prev.variants : {},
            initialized: true
          }))
          console.error('Error fetching feature flags', error)
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
        }
      }
    })()
  }, [shouldFetch])

  useEffect(() => {
    const interval = config.get('FEATURE_FLAGS_INTERVAL')
    intervalRef.current = setInterval(() => {
      setShouldFetch(true)
    }, Number(interval))

    return () => {
      clearInterval(intervalRef.current)
    }
  }, [])

  return <FeatureFlagsContext.Provider value={value}>{props.children}</FeatureFlagsContext.Provider>
}
