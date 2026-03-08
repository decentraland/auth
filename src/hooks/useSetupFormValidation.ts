import { useMemo } from 'react'
import { useTranslation } from '@dcl/hooks'

/**
 * Shared form validation for SetupPage and AvatarSetupPage.
 */
export const useSetupFormValidation = (name: string, email: string, agree: boolean) => {
  const { t } = useTranslation()

  const nameError = useMemo(() => {
    if (!name.length) {
      return t('setup.validation.username_empty')
    }
    if (name.length >= 15) {
      return t('setup.validation.username_max_length')
    }
    if (name.includes(' ')) {
      return t('setup.validation.username_no_spaces')
    }
    if (!/^[a-zA-Z0-9]+$/.test(name)) {
      return t('setup.validation.username_no_special_chars')
    }
    return ''
  }, [name, t])

  const emailError = useMemo(() => {
    if (email && !email.includes('@')) {
      return t('setup.validation.email_invalid')
    }
    return ''
  }, [email, t])

  const agreeError = useMemo(() => {
    if (!agree) {
      return t('setup.validation.agree_required')
    }
    return ''
  }, [agree, t])

  return { nameError, emailError, agreeError }
}
