import { AuthDebugDetails, AuthDebugLog } from './authDebug.type'

const AUTH_DEBUG_QUERY_PARAM = 'authDebug'
const AUTH_DEBUG_STORAGE_KEY = 'dcl_auth_debug'

const MASKED_VALUE = '[REDACTED]'

const isBrowser = () => typeof window !== 'undefined'

const readAuthDebugQueryFlag = (): boolean => {
  if (!isBrowser()) {
    return false
  }

  try {
    const query = new URLSearchParams(window.location.search)
    return query.get(AUTH_DEBUG_QUERY_PARAM) === '1'
  } catch {
    return false
  }
}

const readAuthDebugStorageFlag = (): boolean => {
  if (!isBrowser()) {
    return false
  }

  try {
    return window.localStorage.getItem(AUTH_DEBUG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const persistAuthDebugFlag = () => {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(AUTH_DEBUG_STORAGE_KEY, '1')
  } catch {
    // Ignore storage errors in private mode or restricted contexts.
  }
}

export const isAuthDebugEnabled = (): boolean => {
  const isEnabledFromQuery = readAuthDebugQueryFlag()

  if (isEnabledFromQuery) {
    persistAuthDebugFlag()
    return true
  }

  return readAuthDebugStorageFlag()
}

export const createAuthAttemptId = (prefix = 'auth') => {
  const timestamp = Date.now().toString(36)
  const randomSuffix = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${timestamp}-${randomSuffix}`
}

const maskAccount = (account?: string | null): string => {
  if (!account) {
    return 'n/a'
  }

  if (account.length <= 10) {
    return account
  }

  return `${account.slice(0, 6)}...${account.slice(-4)}`
}

const maskEmail = (email?: string | null): string => {
  if (!email) {
    return 'n/a'
  }

  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) {
    return MASKED_VALUE
  }

  return `${localPart[0]}***@${domain}`
}

const sanitizeValue = (key: string, value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value
  }

  const normalizedKey = key.toLowerCase()

  if (normalizedKey.includes('otp') || normalizedKey.includes('verificationcode') || normalizedKey === 'code') {
    return MASKED_VALUE
  }

  if (normalizedKey.includes('email')) {
    return typeof value === 'string' ? maskEmail(value) : MASKED_VALUE
  }

  if (
    normalizedKey.includes('account') ||
    normalizedKey.includes('address') ||
    normalizedKey.includes('wallet') ||
    normalizedKey.includes('eth')
  ) {
    return typeof value === 'string' ? maskAccount(value) : value
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(`${key}_${index}`, item))
  }

  if (typeof value === 'object') {
    const nested = value as Record<string, unknown>
    const sanitizedEntries = Object.entries(nested).map(([nestedKey, nestedValue]) => [nestedKey, sanitizeValue(nestedKey, nestedValue)])
    return Object.fromEntries(sanitizedEntries)
  }

  return value
}

const sanitizeDetails = (details?: AuthDebugDetails) => {
  if (!details) {
    return undefined
  }

  return Object.fromEntries(Object.entries(details).map(([key, value]) => [key, sanitizeValue(key, value)]))
}

export const authDebug = ({ event, attemptId, account, providerType, step, decision, email, details }: AuthDebugLog) => {
  if (!isAuthDebugEnabled()) {
    return
  }

  const payload = {
    event,
    attemptId: attemptId ?? 'n/a',
    account: maskAccount(account),
    providerType: providerType ?? 'n/a',
    step: step ?? 'n/a',
    decision: decision ?? 'n/a',
    ...(email ? { email: maskEmail(email) } : {}),
    ...(details ? { details: sanitizeDetails(details) } : {})
  }

  console.log('[AuthDebug]', payload)
}
