import { useEffect } from 'react'
import { useTranslation } from '@dcl/hooks'
import successAnimationData from '../../../../assets/animations/Success_Lottie.json'
import { config } from '../../../../modules/config'
import { AnimatedBackground } from '../../../AnimatedBackground'
import { CenteredContainer, Description, SuccessAnimation, TextBlock, Title, TitleCheckIcon, TitleRow } from './SignInCompletePage.styled'

function getExplorerDeeplink(deepLink?: string, bridgeOnly?: boolean): string {
  const env = config.get('ENVIRONMENT').toLowerCase()
  const base = deepLink || 'decentraland://'
  const params = new URLSearchParams()
  if (env !== 'production') {
    params.set('dclenv', env === 'development' ? 'zone' : env)
  }
  if (bridgeOnly) {
    params.set('bridge-only', 'true')
  }
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

type Props = {
  onContinue?: () => void
  deepLink?: string
  skipRedirect?: boolean
  bridgeOnly?: boolean
}

const SignInCompletePage = ({ onContinue, deepLink, skipRedirect, bridgeOnly }: Props) => {
  const { t } = useTranslation()

  useEffect(() => {
    onContinue?.()
    if (!skipRedirect) {
      window.location.href = getExplorerDeeplink(deepLink, bridgeOnly)
    }
  }, [onContinue, deepLink, skipRedirect, bridgeOnly])

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
