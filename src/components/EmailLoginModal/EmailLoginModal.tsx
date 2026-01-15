import { useState, useCallback, useRef, useEffect, KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { handleError } from '../../shared/utils/errorHandler'
import { sendEmailOTP, verifyOTPAndConnect } from './utils'
import { EmailLoginModalProps, EmailLoginStep } from './EmailLoginModal.types'
import styles from './EmailLoginModal.module.css'

const OTP_LENGTH = 6

export const EmailLoginModal = (props: EmailLoginModalProps) => {
  const { open, email, onClose, onBack, onSuccess } = props

  const [step, setStep] = useState<EmailLoginStep>(EmailLoginStep.ENTER_OTP)
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  // Use ref to always have access to current email in callbacks
  const emailRef = useRef(email)
  emailRef.current = email

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(EmailLoginStep.ENTER_OTP)
      setOtp(Array(OTP_LENGTH).fill(''))
      setError(null)
      setIsLoading(false)
      setHasError(false)
      // Focus first OTP input after a short delay
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    }
  }, [open])

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

        // Store email for future reference
        localStorage.setItem('dcl_thirdweb_user_email', currentEmail)

        onSuccess({ email: currentEmail, account })
      } catch (e) {
        const errorMessage = handleError(e, 'Error verifying OTP')
        setError(errorMessage || 'The Code Is Invalid Or Expired. Please Resend Code')
        setHasError(true)
        // Stay in ENTER_OTP step, don't close modal
        setStep(EmailLoginStep.ENTER_OTP)
      } finally {
        setIsLoading(false)
      }
    },
    [otp, onSuccess]
  )

  const handleResendOtp = useCallback(async () => {
    const currentEmail = emailRef.current
    setOtp(Array(OTP_LENGTH).fill(''))
    setError(null)
    setHasError(false)
    setIsLoading(true)

    try {
      console.log('[Thirdweb] Resending OTP to:', currentEmail)
      // Re-send OTP using thirdweb
      await sendEmailOTP(currentEmail)
      // Focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    } catch (e) {
      const errorMessage = handleError(e, 'Error resending OTP')
      setError(errorMessage || 'Failed to resend verification code')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleTryAgain = useCallback(() => {
    setStep(EmailLoginStep.ENTER_OTP)
    setOtp(Array(OTP_LENGTH).fill(''))
    setError(null)
    setHasError(false)
    setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
  }, [])

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

  const renderContent = () => {
    if (step === EmailLoginStep.VERIFYING) {
      return (
        <div className={styles.content}>
          <div className={styles.emailIconContainer}>
            <div className={styles.emailIcon} />
          </div>
          <p className={styles.title}>Verifying...</p>
          <p className={styles.subtitle}>Please wait while we verify your code</p>
          <Loader className={styles.loader} size="medium" inline active />
        </div>
      )
    }

    if (step === EmailLoginStep.ERROR) {
      return (
        <div className={styles.content}>
          <div className={styles.emailIconContainer}>
            <div className={styles.emailIcon} />
          </div>
          <p className={styles.title}>Verification Failed</p>
          {error && <p className={styles.errorMessage}>{error}</p>}
          <div className={styles.buttonContainer}>
            <button className={styles.primaryButton} onClick={handleTryAgain}>
              Try Again
            </button>
            <button className={styles.secondaryButton} onClick={handleBack}>
              Use Different Email
            </button>
          </div>
        </div>
      )
    }

    // ENTER_OTP step
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

        {error && <p className={styles.errorMessage}>⚠ {error}</p>}

        <p className={styles.resendText}>
          Didn't get an email?{' '}
          <span className={styles.resendLink} onClick={!isLoading ? handleResendOtp : undefined}>
            Resend Code
          </span>
        </p>
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
