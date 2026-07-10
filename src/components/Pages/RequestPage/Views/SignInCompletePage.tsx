import { useEffect } from 'react'
import { useTranslation } from '@dcl/hooks'
import successAnimationData from '../../../../assets/animations/Success_Lottie.json'
import { AnimatedBackground } from '../../../AnimatedBackground'
import { getExplorerDeeplink } from '../utils'
import { CenteredContainer, Description, SuccessAnimation, TextBlock, Title, TitleCheckIcon, TitleRow } from './SignInCompletePage.styled'

type Props = {
  onContinue?: () => void
  deepLink?: string
  skipRedirect?: boolean
  bridgeOnly?: boolean
  authRequestId?: string | null
}

const SignInCompletePage = ({ onContinue, deepLink, skipRedirect, bridgeOnly, authRequestId }: Props) => {
  const { t } = useTranslation()

  useEffect(() => {
    onContinue?.()
    if (!skipRedirect) {
      window.location.href = getExplorerDeeplink(deepLink, bridgeOnly, authRequestId)
    }
  }, [onContinue, deepLink, skipRedirect, bridgeOnly, authRequestId])

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

export { SignInCompletePage }
