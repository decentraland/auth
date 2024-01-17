import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { config } from '../../modules/config'
import { defaultFeatureFlagsContextValue, FeatureFlagsContext } from './FeatureFlagsProvider.types'

export const FeatureFlagsProvider = (props: PropsWithChildren<unknown>) => {
  const [value, setValue] = useState(defaultFeatureFlagsContextValue)
  const [shouldFetch, setShouldFetch] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    ;(async () => {
      if (shouldFetch) {
        setShouldFetch(false)
        const baseUrl = config.get('FEATURE_FLAGS_URL')
        const response = await fetch(`${baseUrl}/dapps.json`)
        const json = await response.json()
        setValue({ ...value, flags: json.flags, initialized: true })
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
