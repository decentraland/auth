import { ChangeEvent, KeyboardEvent, useCallback } from 'react'
import { useTranslation } from '@dcl/hooks'
import { GlobalStyles } from 'decentraland-ui2'
import emailIconUrl from '../../assets/images/email.svg'
import { useEmailOtp } from './useEmailOtp'
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

export const EmailLoginModal = (props: EmailLoginModalProps) => {
  const { open, email, onClose, onBack, onSuccess } = props
  const { t } = useTranslation()

  const verify = useCallback(async (emailAddress: string, code: string) => {
    // Verify OTP and connect wallet using thirdweb, then store the email for future reference.
    const address = await verifyOTPAndConnect(emailAddress, code)
    localStorage.setItem('dcl_thirdweb_user_email', emailAddress)
    return { email: emailAddress, address }
  }, [])

  const {
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
  } = useEmailOtp({ open, email, verify, resend: sendEmailOTP, onSuccess })

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
              data-testid={`otp-input-${index}`}
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
            <ResendLinkError disabled={isResendDisabled} onClick={!isResendDisabled ? handleResendOtp : undefined}>
              {resendText}
            </ResendLinkError>
          </>
        )}

        {!error && (
          <ResendText>
            {t('email_login_modal.didnt_get_email')}
            <ResendLink disabled={isResendDisabled} onClick={!isResendDisabled ? handleResendOtp : undefined}>
              {resendText}
            </ResendLink>
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
          <BackButton onClick={handleBack} disabled={isLoading} data-testid="email-login-back-button">
            <BackIcon>‹</BackIcon> {t('email_login_modal.back')}
          </BackButton>
          <CloseButton onClick={handleClose} disabled={isLoading} data-testid="email-login-close-button">
            ×
          </CloseButton>
        </Header>
        <Main>{renderContent()}</Main>
      </StyledDialog>
    </>
  )
}
