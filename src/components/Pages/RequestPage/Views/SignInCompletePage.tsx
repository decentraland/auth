import { useEffect } from 'react'
import { useTranslation } from '@dcl/hooks'
import successAnimationData from '../../../../assets/animations/Success_Lottie.json'
import { config } from '../../../../modules/config'
import { AnimatedBackground } from '../../../AnimatedBackground'
import { CenteredContainer, Description, SuccessAnimation } from './SignInCompletePage.styled'

function getExplorerDeeplink(): string {
  const env = config.get('ENVIRONMENT').toLowerCase()
  if (env === 'production') return 'decentraland://'
  return `decentraland://?dclenv=${env === 'development' ? 'zone' : env}`
}

type Props = {
  onContinue?: () => void
}

const SignInCompletePage = ({ onContinue }: Props) => {
  const { t } = useTranslation()

  useEffect(() => {
    onContinue?.()
    window.location.href = getExplorerDeeplink()
  }, [onContinue])

  return (
    <CenteredContainer>
      <AnimatedBackground variant="absolute" />
      <SuccessAnimation animationData={successAnimationData} loop={false} />
      <Description>
        {t('request_views.sign_in_complete.explorer_description_line1')}
        <br />
        {t('request_views.sign_in_complete.explorer_description_line2')}
      </Description>
    </CenteredContainer>
  )
}

export { SignInCompletePage, getExplorerDeeplink }
