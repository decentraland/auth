export interface AnalyticsWindow extends Window {
  analytics: SegmentAnalytics.AnalyticsJS
}

export function getAnalytics() {
  return (window as AnalyticsWindow).analytics
}
