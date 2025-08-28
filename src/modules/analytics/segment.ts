import { isbot } from 'isbot'

export interface AnalyticsWindow extends Window {
  analytics: SegmentAnalytics.AnalyticsJS
}

export function getAnalytics() {
  //Check if user agent is a bot
  const isBot = isbot(window.navigator.userAgent)

  if (isBot) {
    return undefined
  }

  return (window as AnalyticsWindow).analytics
}
