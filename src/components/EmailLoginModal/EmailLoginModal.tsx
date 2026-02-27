import { ChangeEvent, ClipboardEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { GlobalStyles } from 'decentraland-ui2'
import emailIconUrl from '../../assets/images/email.svg'
import { TrackingEvents } from '../../modules/analytics/types'
import { trackEvent } from '../../shared/utils/analytics'
import { handleError } from '../../shared/utils/errorHandler'
import { sendEmailOTP, verifyOTPAndConnect } from './utils'
import { EmailLoginModalProps } from './EmailLoginModal.types'
import {
  BackButton,
  BackIcon,
  CloseButton,
  Content,
  EmailIcon,
  EmailIconContainer,
  ErrorMessage,
  Header,
  Main,
  OTP_MODAL_ROOT_CLASS,
  OtpContainer,
  OtpInput,
  ResendLink,
  ResendLinkError,
  ResendText,
  StyledDialog,
  Subtitle,
  Title,
  VerifyingContainer,
  VerifyingLoader,
  VerifyingText,
  otpModalContainerGlobalStyles
} from './EmailLoginModal.styled'

const OTP_LENGTH = 6

const getNetworkFriendlyError = (errorMessage: string | undefined, fallback: string, networkError: string): string => {
  if (errorMessage === 'Failed to fetch' || errorMessage?.toLowerCase().includes('network')) {
    return networkError
  }
  return errorMessage || fallback
}

export const EmailLoginModal = (props: EmailLoginModalProps) => {
  const { open, email, onClose, onBack, onSuccess } = props
  const { t } = useTranslation()

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
        setError(t('email_login_modal.enter_complete_code'))
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
        setError(getNetworkFriendlyError(errorMessage, t('email_login_modal.invalid_or_expired'), t('email_login_modal.network_error')))
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

      // Focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    } catch (e) {
      const errorMessage = handleError(e, 'Error resending OTP')
      setError(getNetworkFriendlyError(errorMessage, t('email_login_modal.failed_resend'), t('email_login_modal.network_error')))
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
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
    return (
      <Content>
        <EmailIconContainer>
          <EmailIcon src={emailIconUrl} alt="" />
        </EmailIconContainer>
        <Title>{t('email_login_modal.title')}</Title>
        <Subtitle>
          {t('email_login_modal.subtitle_prefix')}
          <strong>{email}</strong>
          {t('email_login_modal.subtitle_suffix')}
        </Subtitle>

        <OtpContainer hasError={hasError}>
          {otp.map((digit, index) => (
            <OtpInput
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
              hasError={hasError}
              disabled={isLoading}
              autoComplete="one-time-code"
            />
          ))}
        </OtpContainer>

        {isLoading && !error && (
          <VerifyingContainer>
            <VerifyingLoader size={16} />
            <VerifyingText>{t('email_login_modal.verifying')}</VerifyingText>
          </VerifyingContainer>
        )}

        {error && (
          <>
            <ErrorMessage>{error}</ErrorMessage>
            <ResendLinkError onClick={!isLoading ? handleResendOtp : undefined}>{t('email_login_modal.resend_code')}</ResendLinkError>
          </>
        )}

        {!error && (
          <ResendText>
            {t('email_login_modal.didnt_get_email')}
            <ResendLink onClick={!isLoading ? handleResendOtp : undefined}>{t('email_login_modal.resend_code')}</ResendLink>
          </ResendText>
        )}
      </Content>
    )
  }

  return (
    <>
      {/* Only inject when open so we don't affect other modals (e.g. Connection/Metamask modal) */}
      {open && <GlobalStyles styles={otpModalContainerGlobalStyles} />}
      <StyledDialog open={open} maxWidth="sm" fullWidth className={OTP_MODAL_ROOT_CLASS}>
        <Header>
          <BackButton onClick={handleBack} disabled={isLoading}>
            <BackIcon>‹</BackIcon> {t('email_login_modal.back')}
          </BackButton>
          <CloseButton onClick={handleClose} disabled={isLoading}>
            ×
          </CloseButton>
        </Header>
        <Main>{renderContent()}</Main>
      </StyledDialog>
    </>
  )
}
