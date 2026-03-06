import { ChangeEvent, KeyboardEvent, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { isEmailValid } from '../../../shared/email'
import styles from './EmailInput.module.css'

export type EmailInputProps = {
  onSubmit: (email: string) => void
  onEmailChange?: () => void
  isLoading?: boolean
  error?: string | null
}

export const EmailInput = ({ onSubmit, onEmailChange, isLoading, error }: EmailInputProps) => {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isValidEmail = useMemo(() => {
    if (!email) return false
    return isEmailValid(email)
  }, [email])

  const handleEmailChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value)
      onEmailChange?.()
    },
    [onEmailChange]
  )

  const handleSubmit = useCallback(() => {
    if (isValidEmail) {
      onSubmit(email)
    }
  }, [email, isValidEmail, onSubmit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const isValid = isValidEmail
  // Show validation error when user has typed something but it's not a valid email
  const showValidationError = email.length > 0 && !isValidEmail
  const hasError = showValidationError || !!error

  return (
    <div className={styles.container}>
      <label className={styles.label}>{t('email_input.recommended')}</label>
      <div className={styles.inputWrapper}>
        <input
          id="dcl-email-input"
          data-testid="email-input"
          ref={inputRef}
          type="email"
          placeholder={t('email_input.placeholder')}
          value={email}
          onChange={handleEmailChange}
          onKeyDown={handleKeyDown}
          className={`${styles.input} ${hasError ? styles.inputError : ''}`}
          disabled={isLoading}
          autoComplete="email"
        />
        <button data-testid="email-submit-button" className={styles.nextButton} onClick={handleSubmit} disabled={isLoading || !isValid}>
          <span className={isLoading ? styles.textHidden : undefined}>{t('email_input.next')}</span>
          {isLoading && <span className={styles.spinner} />}
        </button>
      </div>
      {showValidationError && <p className={styles.error}>{t('email_input.validation_error')}</p>}
      {error && !showValidationError && <p className={styles.error}>{error}</p>}
    </div>
  )
}
