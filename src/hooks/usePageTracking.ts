import { useEffect } from 'react'
import { getAnalytics } from '../modules/analytics/segment'

const usePageTracking = () => {
  useEffect(() => {
    const analytics = getAnalytics()

    if (analytics) {
      analytics.page()
    }
  }, [])
}

export default usePageTracking
