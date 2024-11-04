export const locations = {
  home: () => '/',
  login: (redirectTo?: string) => `/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
  setup: (redirectTo?: string) => `/setup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`
}
