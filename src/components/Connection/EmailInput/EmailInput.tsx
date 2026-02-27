import { ChangeEvent, KeyboardEvent, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import styles from './EmailInput.module.css'

// RFC 5322 compliant email regex
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export type EmailInputProps = {
  onSubmit: (email: string) => void
  isLoading?: boolean
  error?: string | null
}

export const EmailInput = ({ onSubmit, isLoading, error }: EmailInputProps) => {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isValidEmail = useMemo(() => {
    if (!email) return false
    return EMAIL_REGEX.test(email)
  }, [email])

  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }, [])

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
        <button className={styles.nextButton} onClick={handleSubmit} disabled={isLoading || !isValid}>
          {isLoading ? <span className={styles.spinner} /> : t('email_input.next')}
        </button>
      </div>
      {showValidationError && <p className={styles.error}>{t('email_input.validation_error')}</p>}
      {error && !showValidationError && <p className={styles.error}>{error}</p>}
    </div>
  )
}
