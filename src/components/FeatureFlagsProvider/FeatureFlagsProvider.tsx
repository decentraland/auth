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
          setValue(prev => ({ ...prev, flags: {}, variants: {}, initialized: true }))
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
