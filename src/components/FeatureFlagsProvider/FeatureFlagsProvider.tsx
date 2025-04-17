import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { config } from '../../modules/config'
import { THIRTY_SECONDS } from '../../shared/time'
import { defaultFeatureFlagsContextValue, FeatureFlagsContext } from './FeatureFlagsProvider.types'

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
          const response = await fetch(`${baseUrl}/dapps.json`, { signal: controller.signal })
          const json = await response.json()
          setValue({ ...value, flags: json.flags, initialized: true })
        } catch (error) {
          setValue({ ...value, flags: {}, initialized: true })
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
