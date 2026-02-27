import { useState, useCallback, useRef, useEffect, KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { TrackingEvents } from '../../modules/analytics/types'
import { trackEvent } from '../../shared/utils/analytics'
import { handleError } from '../../shared/utils/errorHandler'
import { sendEmailOTP, verifyOTPAndConnect } from './utils'
import { EmailLoginModalProps } from './EmailLoginModal.types'
import styles from './EmailLoginModal.module.css'

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const getNetworkFriendlyError = (errorMessage: string | undefined, fallback: string): string => {
  if (errorMessage === 'Failed to fetch' || errorMessage?.toLowerCase().includes('network')) {
    return 'Unable to connect. Please check your internet connection and try again.'
  }
  return errorMessage || fallback
}

export const EmailLoginModal = (props: EmailLoginModalProps) => {
  const { open, email, onClose, onBack, onSuccess } = props

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(() => (open ? RESEND_COOLDOWN_SECONDS : 0))

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  // Use ref to always have access to current email in callbacks
  const emailRef = useRef(email)
  emailRef.current = email

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
    [otp]
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
  const handleOtpPaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
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
  }, [])

  const handleOtpSubmit = useCallback(
    async (otpCode?: string) => {
      const code = otpCode || otp.join('')
      const currentEmail = emailRef.current

      if (code.length !== OTP_LENGTH) {
        setError('Please enter the complete verification code')
        return
      }

      console.log('[Thirdweb] Submitting OTP for email:', currentEmail)
      setIsLoading(true)
      setError(null)
      setHasError(false)

      try {
        // Verify OTP and connect wallet using thirdweb
        const account = await verifyOTPAndConnect(currentEmail, code)
        console.log('[Thirdweb] OTP verified successfully!')

        // Store email for future reference
        localStorage.setItem('dcl_thirdweb_user_email', currentEmail)

        // Track OTP verification success
        trackEvent(TrackingEvents.OTP_VERIFICATION_SUCCESS, { email: currentEmail })

        onSuccess({ email: currentEmail, account })
      } catch (e) {
        const errorMessage = handleError(e, 'Error verifying OTP')
        setError(getNetworkFriendlyError(errorMessage, 'The code is invalid or expired. Please resend code'))
        setHasError(true)

        // Track OTP verification failure
        trackEvent(TrackingEvents.OTP_VERIFICATION_FAILURE, { email: currentEmail, error: errorMessage })
      } finally {
        setIsLoading(false)
      }
    },
    [otp, onSuccess]
  )

  const handleResendOtp = useCallback(async () => {
    if (isLoading || resendCooldown > 0) {
      return
    }

    const currentEmail = emailRef.current
    setOtp(Array(OTP_LENGTH).fill(''))
    setError(null)
    setHasError(false)
    setIsLoading(true)

    try {
      console.log('[Thirdweb] Resending OTP to:', currentEmail)
      // Re-send OTP using thirdweb
      await sendEmailOTP(currentEmail)

      // Track OTP resend
      trackEvent(TrackingEvents.OTP_RESEND, { email: currentEmail })
      setResendCooldown(RESEND_COOLDOWN_SECONDS)

      // Focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    } catch (e) {
      const errorMessage = handleError(e, 'Error resending OTP')
      setError(getNetworkFriendlyError(errorMessage, 'Failed to resend verification code'))
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, resendCooldown])

  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose()
    }
  }, [isLoading, onClose])

  const handleBack = useCallback(() => {
    if (!isLoading) {
      onBack()
    }
  }, [isLoading, onBack])

  const isResendDisabled = isLoading || resendCooldown > 0
  const resendCountdown = resendCooldown > 0 ? ` (${formatCountdown(resendCooldown)})` : ''
  const resendText = `Resend Code${resendCountdown}`

  const renderContent = () => {
    return (
      <div className={styles.content}>
        <div className={styles.emailIconContainer}>
          <div className={styles.emailIcon} />
        </div>
        <p className={styles.title}>Enter verification code</p>
        <p className={styles.subtitle}>
          One time password sent to <strong>{email}</strong>. Please enter the code below to complete verification.
        </p>

        <div className={`${styles.otpContainer} ${hasError ? styles.shake : ''}`}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => {
                otpInputRefs.current[index] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleOtpKeyDown(index, e)}
              onPaste={handleOtpPaste}
              className={`${styles.otpInput} ${hasError ? styles.otpInputError : ''}`}
              disabled={isLoading}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {isLoading && !error && (
          <div className={styles.verifyingContainer}>
            <Loader className={styles.verifyingLoader} size="small" inline active />
            <span className={styles.verifyingText}>Verifying...</span>
          </div>
        )}

        {error && (
          <>
            <p className={styles.errorMessage}>{error}</p>
            <span
              className={`${styles.resendLinkError} ${isResendDisabled ? styles.resendLinkDisabled : ''}`}
              onClick={!isResendDisabled ? handleResendOtp : undefined}
            >
              {resendText}
            </span>
          </>
        )}

        {!error && (
          <p className={styles.resendText}>
            Didn't get an email?{' '}
            <span
              className={`${styles.resendLink} ${isResendDisabled ? styles.resendLinkDisabled : ''}`}
              onClick={!isResendDisabled ? handleResendOtp : undefined}
            >
              {resendText}
            </span>
          </p>
        )}
      </div>
    )
  }

  return (
    <Modal size="small" open={open} className={styles.modal}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={handleBack} disabled={isLoading}>
          <span className={styles.backIcon}>‹</span> BACK
        </button>
        <button className={styles.closeButton} onClick={handleClose} disabled={isLoading}>
          ×
        </button>
      </div>
      <div className={styles.main}>{renderContent()}</div>
    </Modal>
  )
}
