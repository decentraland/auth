import { useEffect } from 'react'
import { useTranslation } from '@dcl/hooks'
import successAnimationData from '../../../../assets/animations/Success_Lottie.json'
import { config } from '../../../../modules/config'
import { AnimatedBackground } from '../../../AnimatedBackground'
import { CenteredContainer, Description, SuccessAnimation, TextBlock, Title, TitleCheckIcon, TitleRow } from './SignInCompletePage.styled'

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
      <TextBlock>
        <TitleRow>
          <TitleCheckIcon viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#34CE77" />
            <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#FCFCFC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </TitleCheckIcon>
          <Title>{t('request_views.sign_in_complete.explorer_title')}</Title>
        </TitleRow>
        <Description>{t('request_views.sign_in_complete.explorer_description_line2')}</Description>
      </TextBlock>
    </CenteredContainer>
  )
}

export { SignInCompletePage, getExplorerDeeplink }
