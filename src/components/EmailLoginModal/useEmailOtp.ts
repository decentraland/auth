import { ClipboardEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { TrackingEvents } from '../../modules/analytics/types'
import { trackEvent } from '../../shared/utils/analytics'
import { handleError } from '../../shared/utils/errorHandler'

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 90

const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const getTranslatedApiError = (
  errorMessage: string | undefined,
  fallback: string,
  networkError: string,
  knownErrors?: [string, string][]
): string => {
  if (errorMessage === 'Failed to fetch' || errorMessage?.toLowerCase().includes('network')) {
    return networkError
  }
  if (errorMessage && knownErrors) {
    const lowerMsg = errorMessage.toLowerCase()
    for (const [pattern, translated] of knownErrors) {
      if (lowerMsg.includes(pattern.toLowerCase())) {
        return translated
      }
    }
  }
  return errorMessage || fallback
}

type EmailOtpResult = {
  email: string
  address: string
  identity?: import('@dcl/crypto').AuthIdentity
}

type UseEmailOtpParams = {
  open: boolean
  email: string
  /** Verifies the code, connects/persists, and resolves the success payload. Encapsulates the
   *  desktop vs mobile (test-auth) differences so this hook stays flow-agnostic. */
  verify: (email: string, code: string) => Promise<EmailOtpResult>
  /** Re-sends the OTP to the given email. */
  resend: (email: string) => Promise<void>
  onSuccess: (result: EmailOtpResult) => void
}

/**
 * Shared OTP-input state machine for the desktop and mobile email login modals. Both modals were
 * near-identical 300+ line copies; keeping the stateful logic here prevents the two from diverging
 * (a past divergence introduced a stale-closure bug on the paste-to-autosubmit path).
 *
 * The caller-provided callbacks (verify/resend/onSuccess) and the translation function are held in
 * refs and read at call time, so the returned handlers are stable and never capture a stale closure
 * regardless of whether the caller memoizes them. Failures are surfaced in the returned `error`
 * state (shown in-modal) and reported to Sentry by verify/resend themselves.
 */
function useEmailOtp({ open, email, verify, resend, onSuccess }: UseEmailOtpParams) {
  const { t } = useTranslation()

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(() => (open ? RESEND_COOLDOWN_SECONDS : 0))

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  // Always read the current email/callbacks/translation inside the handlers.
  const emailRef = useRef(email)
  emailRef.current = email
  const verifyRef = useRef(verify)
  verifyRef.current = verify
  const resendRef = useRef(resend)
  resendRef.current = resend
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  const tRef = useRef(t)
  tRef.current = t

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setOtp(Array(OTP_LENGTH).fill(''))
      setError(null)
      setIsLoading(false)
      setHasError(false)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      // Focus first OTP input after a short delay
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (resendCooldown <= 0) {
      return
    }

    const timeoutId = setTimeout(() => {
      setResendCooldown(prev => Math.max(prev - 1, 0))
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [resendCooldown])

  const handleOtpSubmit = useCallback(
    async (otpCode?: string) => {
      const currentT = tRef.current
      const code = otpCode || otp.join('')
      const currentEmail = emailRef.current

      if (code.length !== OTP_LENGTH) {
        setError(currentT('email_login_modal.enter_complete_code'))
        return
      }

      setIsLoading(true)
      setError(null)
      setHasError(false)

      try {
        const result = await verifyRef.current(currentEmail, code)
        // Track OTP verification success
        trackEvent(TrackingEvents.OTP_VERIFICATION_SUCCESS, { email: currentEmail })
        onSuccessRef.current(result)
      } catch (e) {
        const errorMessage = handleError(e, 'Error verifying OTP')
        const translated = getTranslatedApiError(
          errorMessage,
          currentT('email_login_modal.invalid_or_expired'),
          currentT('email_login_modal.network_error'),
          [['failed to verify', currentT('email_login_modal.failed_verify')]]
        )
        setError(translated)
        setHasError(true)

        // Track OTP verification failure
        trackEvent(TrackingEvents.OTP_VERIFICATION_FAILURE, { email: currentEmail, error: errorMessage })
      } finally {
        setIsLoading(false)
      }
    },
    [otp]
  )

  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      const digit = value.replace(/\D/g, '').slice(-1)

      const newOtp = [...otp]
      newOtp[index] = digit
      setOtp(newOtp)
      setError(null)
      setHasError(false)

      // Auto-focus next input
      if (digit && index < OTP_LENGTH - 1) {
        otpInputRefs.current[index + 1]?.focus()
      }

      // Auto-submit when all digits are entered
      if (digit && index === OTP_LENGTH - 1) {
        const completeOtp = newOtp.join('')
        if (completeOtp.length === OTP_LENGTH) {
          handleOtpSubmit(completeOtp)
        }
      }
    },
    [otp, handleOtpSubmit]
  )

  const handleOtpKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus()
      }
    },
    [otp]
  )

  // Handle paste - distribute digits across all inputs
  const handleOtpPaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)

      if (pastedData.length > 0) {
        const newOtp = Array(OTP_LENGTH).fill('')
        for (let i = 0; i < pastedData.length; i++) {
          newOtp[i] = pastedData[i]
        }
        setOtp(newOtp)
        setError(null)
        setHasError(false)

        // Focus the next empty input or the last one
        const nextEmptyIndex = pastedData.length < OTP_LENGTH ? pastedData.length : OTP_LENGTH - 1
        otpInputRefs.current[nextEmptyIndex]?.focus()

        // Auto-submit if all digits are pasted
        if (pastedData.length === OTP_LENGTH) {
          handleOtpSubmit(pastedData)
        }
      }
    },
    [handleOtpSubmit]
  )

  const handleResendOtp = useCallback(async () => {
    if (isLoading || resendCooldown > 0) {
      return
    }

    const currentT = tRef.current
    const currentEmail = emailRef.current
    setOtp(Array(OTP_LENGTH).fill(''))
    setError(null)
    setHasError(false)
    setIsLoading(true)

    try {
      await resendRef.current(currentEmail)

      // Track OTP resend
      trackEvent(TrackingEvents.OTP_RESEND, { email: currentEmail })
      setResendCooldown(RESEND_COOLDOWN_SECONDS)

      // Focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    } catch (e) {
      const errorMessage = handleError(e, 'Error resending OTP')
      const translated = getTranslatedApiError(
        errorMessage,
        currentT('email_login_modal.failed_resend'),
        currentT('email_login_modal.network_error')
      )
      setError(translated)
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, resendCooldown])

  const isResendDisabled = isLoading || resendCooldown > 0
  const resendCountdown = resendCooldown > 0 ? ` (${formatCountdown(resendCooldown)})` : ''
  const resendText = `${t('email_login_modal.resend_code')}${resendCountdown}`

  return {
    otp,
    error,
    isLoading,
    hasError,
    otpInputRefs,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
    handleResendOtp,
    isResendDisabled,
    resendText
  }
}

export { useEmailOtp }
export type { EmailOtpResult }
