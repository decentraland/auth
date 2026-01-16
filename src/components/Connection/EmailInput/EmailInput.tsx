import { useState, useCallback, useRef, KeyboardEvent, ChangeEvent } from 'react'
import styles from './EmailInput.module.css'

export type EmailInputProps = {
  onSubmit: (email: string) => void
  isLoading?: boolean
  error?: string | null
}

export const EmailInput = ({ onSubmit, isLoading, error }: EmailInputProps) => {
  const [email, setEmail] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }, [])

  const handleSubmit = useCallback(() => {
    if (email && email.includes('@')) {
      onSubmit(email)
    }
  }, [email, onSubmit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const isValid = email && email.includes('@')

  return (
    <div className={styles.container}>
      <label className={styles.label}>Recommended</label>
      <div className={styles.inputWrapper}>
        <input
          id="dcl-email-input"
          ref={inputRef}
          type="email"
          placeholder="Enter Your Email"
          value={email}
          onChange={handleEmailChange}
          onKeyDown={handleKeyDown}
          className={styles.input}
          disabled={isLoading}
          autoComplete="email"
        />
        <button className={styles.nextButton} onClick={handleSubmit} disabled={isLoading || !isValid}>
          {isLoading ? <span className={styles.spinner} /> : 'NEXT'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
