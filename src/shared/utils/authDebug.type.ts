export enum AuthDebugEvent {
  CONNECTION_TRY_PREVIOUS_STARTED = 'connection_try_previous_started',
  CONNECTION_TRY_PREVIOUS_RESULT = 'connection_try_previous_result',
  LOGIN_ATTEMPT_STARTED = 'login_attempt_started',
  EMAIL_LOGIN_SUBMIT = 'email_login_submit',
  EMAIL_LOGIN_SESSION_CLEANUP = 'email_login_session_cleanup',
  EMAIL_LOGIN_OTP_REQUESTED = 'email_login_otp_requested',
  EMAIL_LOGIN_SUBMIT_FAILED = 'email_login_submit_failed',
  WALLET_LOGIN_PROFILE_CHECK = 'wallet_login_profile_check',
  LOGIN_ATTEMPT_FAILED = 'login_attempt_failed',
  EMAIL_LOGIN_OTP_VERIFIED = 'email_login_otp_verified',
  EMAIL_LOGIN_IDENTITY_READY = 'email_login_identity_ready',
  EMAIL_LOGIN_CONNECTOR_CONNECTED = 'email_login_connector_connected',
  EMAIL_LOGIN_PROFILE_CHECK = 'email_login_profile_check',
  EMAIL_LOGIN_FAILED = 'email_login_failed',
  REDIRECT_FINAL_URL_INVALID = 'redirect_final_url_invalid',
  PROFILE_CHECK_STARTED = 'profile_check_started',
  PROFILE_CONSISTENCY_CHECKED = 'profile_consistency_checked',
  PROFILE_CHECK_DECISION = 'profile_check_decision',
  THIRDWEB_VERIFY_OTP = 'thirdweb_verify_otp'
}

export enum AuthDebugStep {
  GET_CURRENT_CONNECTION_DATA = 'get-current-connection-data',
  LOGIN_PAGE = 'login-page',
  LOGIN_PAGE_CLOCK_SYNC = 'login-page-clock-sync',
  AFTER_LOGIN_REDIRECTION = 'after-login-redirection',
  AUTH_FLOW = 'auth-flow',
  THIRDWEB_EMAIL_AUTH = 'thirdweb-email-auth'
}

export enum AuthDebugDecision {
  APPLE = 'apple',
  AVATAR_SETUP = 'avatar-setup',
  CONNECTED = 'connected',
  CONSISTENT = 'consistent',
  CONTINUE = 'continue',
  COINBASE = 'coinbase',
  DAPPER = 'dapper',
  DISCORD = 'discord',
  EMAIL = 'email',
  ERROR = 'error',
  FAILED = 'failed',
  FLAGS_NOT_INITIALIZED = 'flags-not-initialized',
  FORTMATIC = 'fortmatic',
  GOOGLE = 'google',
  HOME_FALLBACK = 'home-fallback',
  IDENTITY_MISSING = 'identity-missing',
  INCONSISTENT = 'inconsistent',
  METAMASK = 'metamask',
  METAMASK_MOBILE = 'metamask-mobile',
  MISSING = 'missing',
  NO_ACCOUNT = 'no-account',
  OTP_REQUEST_FAILED = 'otp-request-failed',
  READY = 'ready',
  REDIRECT = 'redirect',
  REDEPLOY_AND_REDIRECT = 'redeploy-and-redirect',
  REDEPLOY_CONTENT_SERVER_AND_REDIRECT = 'redeploy-content-server-and-redirect',
  REQUESTED = 'requested',
  SAMSUNG_BLOCKCHAIN_WALLET = 'samsung-blockchain-wallet',
  SESSION_ALIGNED = 'session-aligned',
  SETUP = 'setup',
  SUCCESS = 'success',
  WALLET_CONNECT = 'wallet-connect',
  WALLET_LINK = 'wallet-link',
  X = 'x'
}

type Primitive = string | number | boolean | null | undefined

export type AuthDebugDetails = Record<string, Primitive | Primitive[] | Record<string, unknown> | unknown[]>

export type AuthDebugLog = {
  event: AuthDebugEvent
  attemptId?: string | null
  account?: string | null
  providerType?: string | null
  step?: AuthDebugStep | null
  decision?: AuthDebugDecision | string | null
  email?: string | null
  details?: AuthDebugDetails
}
