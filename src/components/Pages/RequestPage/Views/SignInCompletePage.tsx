import { useEffect } from 'react'
import { useTranslation } from '@dcl/hooks'
import { config } from '../../../../modules/config'
import { AnimatedBackground } from '../../../AnimatedBackground'
import { CenteredContainer, CheckIconLarge, Description } from './SignInCompletePage.styled'

export function getExplorerDeeplink(): string {
  const env = config.get('ENVIRONMENT').toLowerCase()
  if (env === 'production') return 'decentraland://'
  return `decentraland://?dclenv=${env === 'development' ? 'zone' : env}`
}

type Props = {
  onContinue?: () => void
}

export const SignInCompletePage = ({ onContinue }: Props) => {
  const { t } = useTranslation()

  useEffect(() => {
    onContinue?.()
    window.location.href = getExplorerDeeplink()
  }, [onContinue])

  return (
    <CenteredContainer>
      <AnimatedBackground variant="absolute" />
      <CheckIconLarge>
        <svg width="94" height="94" viewBox="0 0 94 94" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="47" cy="47" r="47" fill="#34C759" />
          <path d="M27 47L41 61L67 35" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </CheckIconLarge>
      <Description>
        {t('request_views.sign_in_complete.explorer_description_line1')}
        <br />
        {t('request_views.sign_in_complete.explorer_description_line2')}
      </Description>
    </CenteredContainer>
  )
}
